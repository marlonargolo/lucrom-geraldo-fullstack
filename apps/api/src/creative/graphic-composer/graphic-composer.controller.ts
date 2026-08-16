import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../../common/guards/api-token.guard';
import { GraphicComposerService } from './graphic-composer.service';
import { ComposeGraphicDto } from './dto/compose-graphic.dto';
import { UpdateGraphicLayersDto } from './dto/update-graphic-layers.dto';

/**
 * Lacuna 2 — Endpoints para o cliente Frontend gerar carrosséis/artes estáticas.
 * Resposta inclui `output_asset_ids`; o Frontend busca cada imagem em
 * GET /api/v1/media-assets/:id (já existente) para obter a `download_url`.
 */
@UseGuards(ApiTokenGuard)
@Controller('api/v1/graphics')
export class GraphicComposerController {
  constructor(private readonly composer: GraphicComposerService) {}

  @Post('compose')
  async compose(@Body() dto: ComposeGraphicDto) {
    return this.composer.compose(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.composer.findOneOrFail(id, tenantId);
  }

  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.composer.findByTenant(tenantId);
  }

  /**
   * Módulo Ajuste Rápido Humano — fonte/tamanho/cor/posição/opacidade/troca
   * de ativo/visibilidade, sem chamar nenhum provedor de IA (ver
   * `GraphicComposerService.updateLayers`). `tenant_id` vem no corpo (mesmo
   * padrão de `ComposeGraphicDto`) e é conferido contra o dono da peça.
   */
  @Patch(':id/layers')
  updateLayers(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateGraphicLayersDto) {
    return this.composer.updateLayers(id, dto.tenant_id, dto);
  }

  @Post(':id/restore/:version')
  restoreVersion(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('version') version: string,
    @Query('tenantId', new ParseUUIDPipe()) tenantId: string,
  ) {
    return this.composer.restoreVersion(id, tenantId, Number(version));
  }
}
