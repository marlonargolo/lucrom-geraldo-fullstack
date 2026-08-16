import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../common/guards/api-token.guard';
import { ConsentService } from './consent.service';
import { CreateConsentDto } from './dto/create-consent.dto';

@UseGuards(ApiTokenGuard)
@Controller('api/v1/consent')
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}

  @Post()
  create(@Body() dto: CreateConsentDto) {
    return this.consent.create({
      tenantId: dto.tenant_id,
      subjectType: dto.subject_type,
      subjectName: dto.subject_name,
      contractS3Key: dto.contract_s3_key,
      expiresAt: dto.expires_at ? new Date(dto.expires_at) : undefined,
    });
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string) {
    return this.consent.revoke(id);
  }

  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.consent.findByTenant(tenantId);
  }

  @Get('check')
  async check(
    @Query('tenant_id') tenantId: string,
    @Query('subject_type') subjectType: 'face' | 'voice',
    @Query('subject_name') subjectName: string,
  ) {
    const valid = await this.consent.hasValidConsent(tenantId, subjectType, subjectName);
    return { valid };
  }
}
