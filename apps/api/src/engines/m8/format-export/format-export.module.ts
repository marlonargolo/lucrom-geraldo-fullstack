import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormatExport } from './format-export.entity';
import { Script } from '../../../creative/script-generator/script.entity';
import { FormatExportService } from './format-export.service';
import { FormatExportController } from './format-export.controller';
import { FfmpegService } from '../ffmpeg.service';
import { MediaAssetsModule } from '../../../media-assets/media-assets.module';
import { GraphicComposerModule } from '../../../creative/graphic-composer/graphic-composer.module';

@Module({
  // StorageModule é @Global() (ver storage.module.ts) — não precisa ser importado aqui.
  imports: [TypeOrmModule.forFeature([FormatExport, Script]), MediaAssetsModule, GraphicComposerModule],
  providers: [FormatExportService, FfmpegService],
  controllers: [FormatExportController],
  exports: [FormatExportService],
})
export class FormatExportModule {}
