import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../../common/guards/api-token.guard';
import { ScriptGeneratorService } from './script-generator.service';
import { GenerateScriptDto } from './dto/generate-script.dto';

/**
 * Lacuna 1 — Endpoints para o cliente Frontend consumir o ScriptGeneratorService.
 * Fluxo típico: POST /generate → guarda o `id` retornado → usar esse id como
 * `script_id` no POST /api/v1/engines/m8/render (contrato original do M8).
 */
@UseGuards(ApiTokenGuard)
@Controller('api/v1/scripts')
export class ScriptGeneratorController {
  constructor(private readonly scriptGenerator: ScriptGeneratorService) {}

  @Post('generate')
  async generate(@Body() dto: GenerateScriptDto) {
    const script = await this.scriptGenerator.generate(dto);
    return script;
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.scriptGenerator.findOneOrFail(id, tenantId);
  }

  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.scriptGenerator.findByTenant(tenantId);
  }
}
