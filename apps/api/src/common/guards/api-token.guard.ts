import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Implementa o contrato `Authorization: Bearer <token>` já especificado no
 * Blueprint Executivo Volume 3 §2 (POST /api/v1/engines/m8/render).
 *
 * MVP: token estático por ambiente (API_TOKEN). Antes de expor a clientes
 * externos reais, trocar por JWT assinado por tenant ou OAuth2 client-credentials.
 */
@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];
    const expected = this.config.get<string>('apiToken');

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Cabeçalho Authorization: Bearer <token> ausente.');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!expected || token !== expected) {
      throw new UnauthorizedException('Token inválido.');
    }
    return true;
  }
}
