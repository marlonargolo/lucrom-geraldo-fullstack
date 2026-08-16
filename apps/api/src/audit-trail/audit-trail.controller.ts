import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../common/guards/api-token.guard';
import { AuditLogService } from './audit-log.service';

/**
 * `GET /api/v1/audit` — trilha de auditoria de governança (quem fez qual
 * ação de escrita), consumida pelo `audit-panel.tsx` do frontend.
 * Distinto de `/api/v1/audit-gate-logs` (qualidade de conteúdo, M10).
 */
@UseGuards(ApiTokenGuard)
@Controller('api/v1/audit')
export class AuditTrailController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  list(@Query('tenant_id') tenantId?: string, @Query('limit') limit?: string) {
    const take = limit ? Math.min(parseInt(limit, 10) || 200, 500) : 200;
    return tenantId ? this.auditLog.findByTenant(tenantId, take) : this.auditLog.findRecent(take);
  }
}
