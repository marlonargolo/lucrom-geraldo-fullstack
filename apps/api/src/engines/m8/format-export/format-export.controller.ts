import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../../../common/guards/api-token.guard';
import { FormatExportService } from './format-export.service';
import { CreateFormatExportDto } from './dto/create-format-export.dto';

@UseGuards(ApiTokenGuard)
@Controller('api/v1/engines/m8/format-export')
export class FormatExportController {
  constructor(private readonly formatExport: FormatExportService) {}

  /**
   * Gera, a partir de `source_asset_id`, as variantes pedidas em `formats`
   * (padrão: reels, story, feed_square, feed_portrait, carousel — todas de
   * uma vez). Síncrono: a resposta já vem com o resultado de cada formato.
   */
  @Post()
  async create(@Body() dto: CreateFormatExportDto) {
    return this.formatExport.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Query('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.formatExport.findOneOrFail(id, tenantId);
  }

  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.formatExport.findByTenant(tenantId);
  }
}
