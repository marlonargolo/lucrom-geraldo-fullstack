import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../../../common/guards/api-token.guard';
import { VideoEditService } from './video-edit.service';
import { CreateVideoEditDto } from './dto/create-video-edit.dto';

@UseGuards(ApiTokenGuard)
@Controller('api/v1/engines/m8/edit')
export class VideoEditController {
  constructor(private readonly videoEdit: VideoEditService) {}

  /**
   * Corta um vídeo já gerado (`source_asset_id`) e opcionalmente aplica
   * legenda. Síncrono: a resposta já vem com o `output_asset_id` pronto.
   */
  @Post()
  async create(@Body() dto: CreateVideoEditDto) {
    return this.videoEdit.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Query('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.videoEdit.findOneOrFail(id, tenantId);
  }

  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.videoEdit.findByTenant(tenantId);
  }
}
