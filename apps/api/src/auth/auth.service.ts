import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import { RedisService } from '../common/redis/redis.service';
import { Tenant } from '../tenants/tenant.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { User } from './user.entity';

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora
const MAX_RESET_REQUESTS = 3; // por e-mail, por janela de 1 hora
const FORGOT_PASSWORD_MESSAGE = 'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.';

export interface JwtPayload {
  sub: string; // user.id
  tenantId: string;
  email: string;
  role: string;
}

/**
 * Service NestJS de autenticação, injetando Repository/DataSource pelo DI
 * container. Regras de negócio:
 *  - senha com bcrypt (12 rounds);
 *  - rate limit de login por Redis (contador atômico), não em memória do
 *    processo — correto mesmo com múltiplas réplicas atrás de um load balancer;
 *  - mensagem de erro idêntica para "e-mail não existe" e "senha errada",
 *    pra nunca revelar qual dos dois foi o motivo (evita enumeração de e-mails).
 *
 * Diferença de negócio (auto-cadastro): ver comentário em RegisterDto.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ id: string; email: string; tenantId: string; accessToken: string }> {
    const email = dto.email.toLowerCase();

    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const tenantName = dto.businessName?.trim() || email.split('@')[0];

    // Transação: tenant + primeiro usuário (ADMIN) nascem juntos, ou nenhum
    // dos dois é persistido — evita tenant "órfão" sem usuário em caso de
    // falha no meio do caminho.
    const { tenant, user } = await this.dataSource.transaction(async (manager) => {
      const tenant = await manager.save(
        Tenant,
        manager.create(Tenant, {
          name: tenantName,
          plan_tier: 'CREATOR',
        }),
      );
      const user = await manager.save(
        User,
        manager.create(User, {
          tenant_id: tenant.id,
          email,
          password_hash,
          role: 'ADMIN',
          last_login_at: null,
          terms_version: dto.termsVersion.trim(),
          privacy_version: dto.privacyVersion.trim(),
          legal_accepted_at: new Date(),
          is_platform_admin: false,
        }),
      );
      return { tenant, user };
    });

    const accessToken = this.signToken({ sub: user.id, tenantId: tenant.id, email: user.email, role: user.role });
    return { id: user.id, email: user.email, tenantId: tenant.id, accessToken };
  }

  async login(
    dto: LoginDto,
    clientIp: string,
  ): Promise<{ accessToken: string; user: { id: string; email: string; tenantId: string; role: string; isPlatformAdmin: boolean } }> {
    const email = dto.email.toLowerCase();
    const rateLimitKey = `auth:login-attempts:${clientIp}:${email}`;
    await this.assertNotRateLimited(rateLimitKey);

    const user = await this.users.findOne({ where: { email } });
    const passwordMatches = user ? await bcrypt.compare(dto.password, user.password_hash) : false;

    if (!user || !passwordMatches) {
      await this.redis.incrWithWindowMs(rateLimitKey, LOGIN_WINDOW_MS);
      // Mensagem idêntica para os dois casos — não revelar qual foi o motivo.
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    await this.redis.del(rateLimitKey);
    user.last_login_at = new Date();
    await this.users.save(user);

    const accessToken = this.signToken({ sub: user.id, tenantId: user.tenant_id, email: user.email, role: user.role });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenant_id,
        role: user.role,
        isPlatformAdmin: user.is_platform_admin === true,
      },
    };
  }

  /**
   * Recuperação de senha — passo 1. SEMPRE responde a mesma mensagem, exista
   * o e-mail ou não (evita enumeração de contas). Quando existe, gera um
   * token aleatório de uso único (só o hash SHA-256 fica no Redis, TTL 1h).
   *
   * Entrega: não há provedor de e-mail configurado neste backend ainda. Fora
   * de produção o link é escrito no log para teste; em produção só um aviso é
   * registrado (o link NUNCA é logado em produção). Plugar o envio de e-mail
   * em `deliverResetLink`.
   */
  async forgotPassword(emailRaw: string): Promise<{ message: string }> {
    const email = emailRaw.toLowerCase().trim();
    const throttleKey = `auth:reset-requests:${email}`;
    const requests = await this.redis.incrWithWindowMs(throttleKey, RESET_TOKEN_TTL_MS);
    if (requests > MAX_RESET_REQUESTS) return { message: FORGOT_PASSWORD_MESSAGE };

    const user = await this.users.findOne({ where: { email } });
    if (!user) return { message: FORGOT_PASSWORD_MESSAGE };

    const token = randomBytes(32).toString('base64url');
    await this.redis.setWithTtlMs(`auth:reset-token:${this.hashToken(token)}`, user.id, RESET_TOKEN_TTL_MS);
    this.deliverResetLink(user.email, token);
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  /** Recuperação de senha — passo 2: troca a senha usando o token (uso único). */
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const key = `auth:reset-token:${this.hashToken(token)}`;
    const userId = await this.redis.get(key);
    if (!userId) throw new BadRequestException('Link de recuperação inválido ou expirado. Solicite um novo.');
    await this.redis.del(key);

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('Link de recuperação inválido ou expirado. Solicite um novo.');

    user.password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.users.save(user);
    return { message: 'Senha alterada. Entre com a nova senha.' };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private deliverResetLink(email: string, token: string): void {
    const siteUrl = (process.env.PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
    const link = `${siteUrl}/studio/login?reset=${encodeURIComponent(token)}`;
    if (this.config.get<string>('nodeEnv') !== 'production') {
      this.logger.log(`[dev] Link de recuperação de senha para ${email}: ${link}`);
      return;
    }
    this.logger.warn(
      `Pedido de recuperação de senha para ${email}, mas nenhum provedor de e-mail está configurado — link não enviado.`,
    );
  }

  private signToken(payload: JwtPayload): string {
    return this.jwt.sign(payload);
  }

  private async assertNotRateLimited(key: string): Promise<void> {
    const count = await this.redis.get(key);
    if (!count) return;
    if (parseInt(count, 10) >= MAX_LOGIN_ATTEMPTS) {
      const retryAfterMs = await this.redis.pttl(key);
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      throw new UnauthorizedException(`Muitas tentativas de login. Tente novamente em ${retryAfterSeconds}s.`);
    }
  }
}
