import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoEdit } from './video-edit.entity';
import { VideoEditService } from './video-edit.service';
import { VideoEditController } from './video-edit.controller';
import { FfmpegService } from '../ffmpeg.service';
import { MediaAssetsModule } from '../../../media-assets/media-assets.module';

@Module({
  // StorageModule é @Global() (ver storage.module.ts) — não precisa ser importado aqui.
  imports: [TypeOrmModule.forFeature([VideoEdit]), MediaAssetsModule],
  providers: [VideoEditService, FfmpegService],
  controllers: [VideoEditController],
  exports: [VideoEditService],
})
export class VideoEditModule {}
