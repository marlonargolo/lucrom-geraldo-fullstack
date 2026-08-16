import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RenderJob } from './render-job.entity';
import { MediaAsset } from '../../media-assets/media-asset.entity';
import { M8ProcessorCore } from './m8-processor.core';
import { FfmpegService } from './ffmpeg.service';
import { M8HighPriorityProcessor, M8StandardProcessor } from './m8.processor';
import { QueueModule } from '../../queue/queue.module';
import { AuditModule } from '../../audit/audit.module';
import { QualityDirectorModule } from '../../quality-director/quality-director.module';
import { ReplicateClientService } from './replicate-client.service';
import { VideoMattingService } from './video-matting.service';
import { AudioCleanService } from './audio-clean.service';
import { NichePresetService } from './niche-preset.service';
import { MotionLegendsService } from './motion-legends.service';

@Module({
  imports: [TypeOrmModule.forFeature([RenderJob, MediaAsset]), QueueModule, AuditModule, QualityDirectorModule],
  providers: [
    // ─── Infraestrutura (original) ──────────────────────
    M8ProcessorCore,
    FfmpegService,
    M8HighPriorityProcessor,
    M8StandardProcessor,
    // ─── Etapas 1-3 via Replicate (adições) ─────────────
    ReplicateClientService,
    AudioCleanService,
    VideoMattingService,
    NichePresetService,
    MotionLegendsService,
  ],
})
export class M8WorkerModule {}
