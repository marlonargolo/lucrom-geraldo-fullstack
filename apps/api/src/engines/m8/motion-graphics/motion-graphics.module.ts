import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../../tenants/tenant.entity';
import { MediaAsset } from '../../../media-assets/media-asset.entity';
import { MediaAssetsModule } from '../../../media-assets/media-assets.module';
import { MotionGraphicsService } from './motion-graphics.service';
import { MotionGraphicsController } from './motion-graphics.controller';
import { FfmpegService } from '../ffmpeg.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, MediaAsset]), MediaAssetsModule],
  providers: [MotionGraphicsService, FfmpegService],
  controllers: [MotionGraphicsController],
  exports: [MotionGraphicsService],
})
export class MotionGraphicsModule {}
