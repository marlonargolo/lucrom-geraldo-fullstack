import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NichePreset } from './entities/niche-preset.entity';
import { BrandKit } from './entities/brand-kit.entity';
import { NichePresetsService } from './niche-presets.service';
import { BrandKitsService } from './brand-kits.service';
import { BrandController } from './brand.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * Módulo de Brand Kit + Nicho como dado no banco.
 *
 * Expõe:
 *   POST/GET /brand/niche-presets
 *   POST/GET /brand/brand-kits
 *
 * Importa AuthModule porque BrandController usa JwtAuthGuard, que depende
 * de JwtService (fornecido por AuthModule).
 */
@Module({
  imports: [TypeOrmModule.forFeature([NichePreset, BrandKit]), AuthModule],
  controllers: [BrandController],
  providers: [NichePresetsService, BrandKitsService],
  exports: [NichePresetsService, BrandKitsService],
})
export class BrandModule {}
