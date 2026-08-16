import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueModule } from '../../../queue/queue.module';
import { MediaAssetsModule } from '../../../media-assets/media-assets.module';
import { AiGenerationJob } from '../ai-orchestrator/ai-generation-job.entity';
import { VideoRenderWorker } from './video-render.worker';
import { FfmpegService } from '../ffmpeg.service';

/**
 * Só é importado pelo processo WORKER (worker.module.ts / container `worker`
 * do docker-compose) — a API HTTP nunca consome esta fila, só publica jobs
 * nela (ver WebhooksModule).
 */
@Module({
  imports: [QueueModule, TypeOrmModule.forFeature([AiGenerationJob]), MediaAssetsModule],
  providers: [VideoRenderWorker, FfmpegService],
})
export class VideoRenderWorkerModule {}
