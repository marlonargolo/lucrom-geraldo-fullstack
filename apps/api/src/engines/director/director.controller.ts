import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../../common/guards/api-token.guard';
import { DirectorService } from './director.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { AdvanceBusinessDto } from './dto/advance-business.dto';
import { AdvanceStrategyDto } from './dto/advance-strategy.dto';
import { AdvanceCreativeDto } from './dto/advance-creative.dto';
import { AdvanceProductionDto } from './dto/advance-production.dto';

/**
 * Contrato exato esperado por `apps/web/lib/production/backend-proxy.ts`
 * (`proxyToDirectorEngine`): `Authorization: Bearer <API_TOKEN>` (serviço-a-
 * serviço) — o Next.js já faz o gate de login do usuário (X-User-Token) ANTES
 * de chamar aqui, então esta rota não duplica esse guard, só o de serviço.
 */
@UseGuards(ApiTokenGuard)
@Controller('api/v1/engines/director/sessions')
export class DirectorController {
  constructor(private readonly director: DirectorService) {}

  @Post()
  create(@Body() dto: CreateSessionDto) {
    return this.director.createSession(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.director.findOneOrFail(id, tenantId);
  }

  @Get(':id/production-contract')
  findProductionContract(@Param('id') id: string, @Query('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.director.findProductionContractBySession(id, tenantId);
  }

  @Get(':id/render-status')
  getRenderStatus(@Param('id') id: string, @Query('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.director.getRenderStatus(id, tenantId);
  }

  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.director.findByTenant(tenantId);
  }

  @Post(':id/business')
  advanceBusiness(@Param('id') id: string, @Body() dto: AdvanceBusinessDto) {
    return this.director.advanceBusiness(id, dto);
  }

  @Post(':id/strategy')
  advanceStrategy(@Param('id') id: string, @Body() dto: AdvanceStrategyDto) {
    return this.director.advanceStrategy(id, dto);
  }

  @Post(':id/creative')
  advanceCreative(@Param('id') id: string, @Body() dto: AdvanceCreativeDto) {
    return this.director.advanceCreative(id, dto);
  }

  @Post(':id/production')
  advanceProduction(@Param('id') id: string, @Body() dto: AdvanceProductionDto) {
    return this.director.advanceProduction(id, dto);
  }
}
