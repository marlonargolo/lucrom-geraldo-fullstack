import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuditLogService } from '../../audit-trail/audit-log.service';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Campos que nunca são persistidos em `audit_logs.request_body` (dados sensíveis/PII). */
const REDACTED_KEYS = new Set(['password', 'token', 'api_key', 'apiKey', 'authorization', 'document', 'contract_s3_key']);

function redactBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    clone[k] = REDACTED_KEYS.has(k) ? '[REDACTED]' : v;
  }
  return clone;
}

/**
 * Middleware global aplicado a todas as rotas (ver AppModule.configure()).
 * Para métodos de escrita (POST/PUT/PATCH/DELETE), grava uma linha em
 * `audit_logs` após a resposta ser enviada, com o status HTTP final.
 *
 * Identificação do ator: como o ApiTokenGuard hoje usa um token estático por
 * ambiente (não um JWT de usuário — ver api-token.guard.ts), este middleware
 * aceita opcionalmente um JWT de sessão em `X-Actor-Token` para enriquecer o
 * campo `actor` com quem de fato realizou a ação. Na ausência desse header
 * (ou de JWT_SECRET configurado para verificá-lo), o actor cai para
 * 'api_token' — nunca bloqueia a requisição, é auditoria, não autorização.
 */
@Injectable()
export class AuthAuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthAuditMiddleware.name);
  private readonly jwtSecret: string;

  constructor(
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret = this.config.get<string>('jwt.secret') ?? '';
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (!WRITE_METHODS.has(req.method)) {
      next();
      return;
    }

    const startedAt = Date.now();
    const actor = this.resolveActor(req);

    res.on('finish', () => {
      const tenantId =
        (req.body && (req.body as Record<string, unknown>).tenant_id) ||
        req.params?.tenantId ||
        (req.query?.tenant_id as string | undefined) ||
        null;

      this.auditLog
        .record({
          tenantId: (tenantId as string) ?? null,
          actor,
          method: req.method,
          route: req.originalUrl,
          statusCode: res.statusCode,
          ipAddress: req.ip ?? null,
          requestBody: redactBody(req.body),
          durationMs: Date.now() - startedAt,
        })
        .catch((err) => this.logger.warn(`Falha ao gravar audit_log: ${(err as Error).message}`));
    });

    next();
  }

  private resolveActor(req: Request): string {
    const actorToken = req.headers['x-actor-token'];
    if (!actorToken || typeof actorToken !== 'string') return 'api_token';

    try {
      const decoded = this.jwtSecret ? jwt.verify(actorToken, this.jwtSecret) : jwt.decode(actorToken);
      if (decoded && typeof decoded === 'object') {
        const payload = decoded as Record<string, unknown>;
        return String(payload.sub ?? payload.email ?? payload.name ?? 'usuario_autenticado');
      }
    } catch {
      // JWT ausente/inválido/expirado não bloqueia a requisição — só perde o enriquecimento do ator.
      return 'api_token';
    }
    return 'api_token';
  }
}
