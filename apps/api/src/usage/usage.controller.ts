import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.service';
import { UsageService } from './usage.service';

/**
 * Isolamento de tenants: `tenantId` vem sempre do JWT verificado pelo
 * JwtAuthGuard (`req.user.tenantId`), nunca de parâmetro de URL/query.
 * Isso garante que cada usuário só pode consultar/consumir a cota do
 * próprio tenant, o mesmo que está no seu token — evitando IDOR.
 */
@UseGuards(JwtAuthGuard)
@Controller('api/v1/usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Get('peek')
  peek(@Req() req: Request) {
    const { tenantId } = (req as Request & { user: JwtPayload }).user;
    return this.usage.peek(tenantId);
  }

  /**
   * Chamado pelas Route Handlers de IA do apps/web (ver
   * lib/auth/require-user-quota.ts) ANTES de iniciar uma geração paga —
   * consome 1 unidade e responde `allowed: false` (a rota chamadora traduz
   * pra HTTP 402) se o tenant já estourou o limite do mês.
   */
  @Post('consume')
  consume(@Req() req: Request) {
    const { tenantId } = (req as Request & { user: JwtPayload }).user;
    return this.usage.consume(tenantId);
  }
}
