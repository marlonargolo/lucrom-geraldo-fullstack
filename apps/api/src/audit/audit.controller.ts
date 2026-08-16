import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../common/guards/api-token.guard';
import { AuditService } from './audit.service';

@UseGuards(ApiTokenGuard)
@Controller('api/v1/audit-gate-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('asset/:assetId')
  byAsset(@Param('assetId') assetId: string) {
    return this.audit.findByAsset(assetId);
  }

  @Get('tenant/:tenantId')
  byTenant(@Param('tenantId') tenantId: string) {
    return this.audit.findByTenant(tenantId);
  }
}
