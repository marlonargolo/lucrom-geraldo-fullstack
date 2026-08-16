import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../../../common/guards/api-token.guard';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { GenerateVideoAsyncDto } from './dto/generate-video-async.dto';

/**
 * Geração de Vídeo Assíncrona — a API aceita a requisição e retorna
 * IMEDIATAMENTE `202 Accepted`; o resultado chega depois via
 * `POST /api/v1/webhooks/ai-video`. Consumido pelo `briefing-composer.tsx`.
 */
@UseGuards(ApiTokenGuard)
@Controller('api/v1/engines/m8/ai-video')
export class AiOrchestratorController {
  constructor(private readonly orchestrator: AiOrchestratorService) {}

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generate(@Body() dto: GenerateVideoAsyncDto) {
    const job = await this.orchestrator.submit(dto);
    return job; // status PENDING/PROCESSING/FAILED — nunca bloqueia esperando o provedor
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.orchestrator.findOneOrFail(id, tenantId);
  }

  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.orchestrator.findByTenant(tenantId);
  }
}
