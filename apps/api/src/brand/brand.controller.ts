import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BrandKitsService } from './brand-kits.service';
import { CreateBrandKitDto } from './dto/create-brand-kit.dto';
import { CreateNichePresetDto } from './dto/create-niche-preset.dto';
import { NichePresetsService } from './niche-presets.service';

@UseGuards(JwtAuthGuard)
@Controller('brand')
export class BrandController {
  constructor(
    private readonly nichePresets: NichePresetsService,
    private readonly brandKits: BrandKitsService,
  ) {}

  @Get('niche-presets')
  listNichePresets() {
    return this.nichePresets.findAll();
  }

  @Post('niche-presets')
  createNichePreset(@Body() dto: CreateNichePresetDto) {
    return this.nichePresets.create(dto);
  }

  @Get('brand-kits')
  listBrandKits(@Query('tenant_id') tenantId: string) {
    return this.brandKits.findByTenant(tenantId);
  }

  @Post('brand-kits')
  createBrandKit(@Body() dto: CreateBrandKitDto) {
    return this.brandKits.create(dto);
  }

  @Get('brand-kits/:id/composer-dto')
  getComposerDto(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.brandKits.toComposerDto(id, tenantId);
  }
}
