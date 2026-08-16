import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { QUEUE_AVATAR_RENDER, AvatarRenderJobData } from '../../../queue/queue.constants';
import { FfmpegService } from '../../m8/ffmpeg.service';
import { StorageService } from '../../../storage/storage.service';
import { MediaAssetsService } from '../../../media-assets/media-assets.service';
import { AvatarGenerationJob } from '../avatar-generation-job.entity';

/**
 * Worker ISOLADO (BullMQ) do pipeline de Avatar: baixa o vídeo com lip-sync
 * retornado pela Kling, roda o MESMO `FfmpegService.cropToAspectRatio` já
 * usado por `video-render.worker.ts` (nenhuma lógica de FFmpeg duplicada),
 * e faz o upload final no S3/MinIO como um novo `media_asset`.
 *
 * Roda no processo `worker` do docker-compose (ver worker.module.ts) — nunca
 * no processo HTTP da API, mesmo motivo de `video-render.worker.ts`.
 */
@Processor(QUEUE_AVATAR_RENDER)
export class AvatarRenderWorker extends WorkerHost {
  private readonly logger = new Logger(AvatarRenderWorker.name);

  constructor(
    @InjectRepository(AvatarGenerationJob) private readonly avatarJobs: Repository<AvatarGenerationJob>,
    private readonly ffmpeg: FfmpegService,
    private readonly storage: StorageService,
    private readonly mediaAssets: MediaAssetsService,
  ) {
    super();
  }

  async process(job: Job<AvatarRenderJobData>): Promise<void> {
    const { avatarGenerationJobId, tenantId, rawVideoUrl, aspectRatio } = job.data;
    this.logger.log(`[${QUEUE_AVATAR_RENDER}] processando job ${job.id} (avatar_generation_job=${avatarGenerationJobId})`);

    const avatarJob = await this.avatarJobs.findOne({ where: { id: avatarGenerationJobId } });
    if (!avatarJob) {
      this.logger.error(`avatar_generation_job ${avatarGenerationJobId} não encontrado — abortando.`);
      return;
    }

    let rawPath: string | null = null;
    let croppedPath: string | null = null;

    try {
      // 1) Baixa o vídeo com lip-sync retornado pela Kling.
      rawPath = await this.storage.downloadFromUrlToTemp(rawVideoUrl, 'mp4');

      // 2) FFmpeg CLI: redimensiona/enquadra para o aspect ratio pedido — mesmo método do video-render.worker.ts.
      croppedPath = await this.ffmpeg.cropToAspectRatio({ inputPath: rawPath, aspectRatio });
      const finalBuffer = await this.ffmpeg.readAndCleanup(croppedPath);
      croppedPath = null; // já foi lido e removido por readAndCleanup

      // 3) Upload do arquivo final no S3/MinIO, registrado como media_asset.
      const asset = await this.mediaAssets.uploadAndRegister({
        tenantId,
        buffer: finalBuffer,
        contentType: 'video/mp4',
        fileType: 'video/mp4',
        engineSource: 'AVATAR_ENGINE',
        extraMetadata: { source: 'avatar_generation_job', avatar_generation_job_id: avatarGenerationJobId, aspect_ratio: aspectRatio },
      });

      avatarJob.status = 'DONE';
      avatarJob.final_asset_id = asset.id;
      await this.avatarJobs.save(avatarJob);
      this.logger.log(`avatar_generation_job ${avatarGenerationJobId} finalizado — media_asset ${asset.id}.`);
    } catch (err) {
      avatarJob.status = 'FAILED';
      avatarJob.error_message = (err as Error).message;
      await this.avatarJobs.save(avatarJob);
      this.logger.error(`Falha no pós-processamento do avatar_generation_job ${avatarGenerationJobId}: ${(err as Error).message}`);
      throw err; // deixa o BullMQ aplicar sua política de retry/backoff padrão
    } finally {
      if (rawPath) await this.ffmpeg.readAndCleanup(rawPath).catch(() => undefined);
      if (croppedPath) await this.ffmpeg.readAndCleanup(croppedPath).catch(() => undefined);
    }
  }
}
