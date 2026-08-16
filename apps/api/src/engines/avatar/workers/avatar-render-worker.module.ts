import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueModule } from '../../../queue/queue.module';
import { MediaAssetsModule } from '../../../media-assets/media-assets.module';
import { AvatarGenerationJob } from '../avatar-generation-job.entity';
import { AvatarRenderWorker } from './avatar-render.worker';
import { FfmpegService } from '../../m8/ffmpeg.service';

/**
 * Só é importado pelo processo WORKER (worker.module.ts / container `worker`
 * do docker-compose) — mesmo padrão de `video-render-worker.module.ts`.
 */
@Module({
  imports: [QueueModule, TypeOrmModule.forFeature([AvatarGenerationJob]), MediaAssetsModule],
  providers: [AvatarRenderWorker, FfmpegService],
})
export class AvatarRenderWorkerModule {}
