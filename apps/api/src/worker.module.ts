import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './storage/storage.module';
import { M8WorkerModule } from './engines/m8/m8-worker.module';
import { VideoRenderWorkerModule } from './engines/m8/workers/video-render-worker.module';
import { AvatarRenderWorkerModule } from './engines/avatar/workers/avatar-render-worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    StorageModule,
    M8WorkerModule,
    // ─── Processamento Assíncrono com FFmpeg — worker isolado (aspect ratio + upload S3) ───
    VideoRenderWorkerModule,
    // ─── Avatar Real + Voz Clonada + Lip-Sync — worker isolado (mesmo FfmpegService) ───
    AvatarRenderWorkerModule,
  ],
})
export class WorkerModule {}
