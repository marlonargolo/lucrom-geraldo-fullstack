import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtPayload } from './auth.service';

/**
 * Guard de sessão de usuário. Aceita o token em DOIS formatos, pra cobrir os
 * dois consumidores reais desta API:
 *  - `X-User-Token: <jwt>` — usado pelo frontend Next.js (apps/web), ver
 *    lib/api/client.ts e lib/auth/require-user.ts (que por sua vez repassa
 *    esse MESMO header nas chamadas server-to-server que ele faz de volta
 *    pra cá, ex.: POST /api/v1/usage/consume).
 *  - `Authorization: Bearer <jwt>` — formato padrão, usado por chamadas
 *    diretas (Postman, testes, outros clients).
 *
 * Distinto do `ApiTokenGuard` (token estático de serviço).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException('Sessão ausente (X-User-Token ou Authorization: Bearer).');
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      (req as Request & { user: JwtPayload }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
  }

  private extractToken(req: Request): string | null {
    const userToken = req.headers['x-user-token'];
    if (typeof userToken === 'string' && userToken.trim()) return userToken.trim();

    const header = req.headers['authorization'];
    if (header && header.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();

    return null;
  }
}
