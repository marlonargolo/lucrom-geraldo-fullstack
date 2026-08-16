import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../../common/guards/api-token.guard';
import { M8Service } from './m8.service';
import { RenderM8Dto } from './dto/render-m8.dto';

@UseGuards(ApiTokenGuard)
@Controller('api/v1/engines/m8')
export class M8Controller {
  constructor(private readonly m8: M8Service) {}

  /**
   * Contrato idêntico ao Blueprint Executivo Volume 3 §2. Resposta 202 com o
   * id do job — o processamento é assíncrono (fila jobs:render:*), consultar
   * o status em GET /api/v1/engines/m8/render/:id.
   */
  @Post('render')
  async render(@Body() dto: RenderM8Dto) {
    const job = await this.m8.enqueueRender(dto);
    return {
      render_job_id: job.id,
      status: job.status,
      queue: job.queue_name,
      queue_job_id: job.queue_job_id,
    };
  }

  @Get('render/:id')
  async status(@Param('id') id: string, @Query('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.m8.findOneOrFail(id, tenantId);
  }

  @Get('render/tenant/:tenantId')
  byTenant(@Param('tenantId') tenantId: string) {
    return this.m8.findByTenant(tenantId);
  }
}
