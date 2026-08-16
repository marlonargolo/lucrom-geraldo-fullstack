import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
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
        }),
      );
      return { tenant, user };
    });

    const accessToken = this.signToken({ sub: user.id, tenantId: tenant.id, email: user.email, role: user.role });
    return { id: user.id, email: user.email, tenantId: tenant.id, accessToken };
  }

  async login(dto: LoginDto, clientIp: string): Promise<{ accessToken: string; user: { id: string; email: string; tenantId: string; role: string } }> {
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
    return { accessToken, user: { id: user.id, email: user.email, tenantId: user.tenant_id, role: user.role } };
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
