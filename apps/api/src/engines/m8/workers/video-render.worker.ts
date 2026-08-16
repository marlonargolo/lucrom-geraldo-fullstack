import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { QUEUE_VIDEO_RENDER, VideoRenderJobData } from '../../../queue/queue.constants';
import { FfmpegService } from '../ffmpeg.service';
import { StorageService } from '../../../storage/storage.service';
import { MediaAssetsService } from '../../../media-assets/media-assets.service';
import { AiGenerationJob } from '../ai-orchestrator/ai-generation-job.entity';

/**
 * Worker ISOLADO (BullMQ) do pipeline de Geração de Vídeo Assíncrona:
 * baixa o vídeo bruto retornado pelo provedor de IA (Fal.ai/Replicate),
 * roda o FFmpeg CLI (via FfmpegService.cropToAspectRatio) para adaptar ao
 * aspect ratio pedido no briefing, e faz o upload final no Amazon S3 (ou
 * MinIO local, conforme StorageService) como um novo `media_asset`.
 *
 * Roda no processo `worker` do docker-compose (ver worker.module.ts) — nunca
 * no processo HTTP da API, mantendo a API responsiva mesmo sob carga de render.
 */
@Processor(QUEUE_VIDEO_RENDER)
export class VideoRenderWorker extends WorkerHost {
  private readonly logger = new Logger(VideoRenderWorker.name);

  constructor(
    @InjectRepository(AiGenerationJob) private readonly aiJobs: Repository<AiGenerationJob>,
    private readonly ffmpeg: FfmpegService,
    private readonly storage: StorageService,
    private readonly mediaAssets: MediaAssetsService,
  ) {
    super();
  }

  async process(job: Job<VideoRenderJobData>): Promise<void> {
    const { aiGenerationJobId, tenantId, rawVideoUrl, aspectRatio } = job.data;
    this.logger.log(`[${QUEUE_VIDEO_RENDER}] processando job ${job.id} (ai_generation_job=${aiGenerationJobId})`);

    const aiJob = await this.aiJobs.findOne({ where: { id: aiGenerationJobId } });
    if (!aiJob) {
      this.logger.error(`ai_generation_job ${aiGenerationJobId} não encontrado — abortando.`);
      return;
    }

    let rawPath: string | null = null;
    let croppedPath: string | null = null;

    try {
      // 1) Baixa o vídeo bruto retornado pelo provedor de IA.
      rawPath = await this.storage.downloadFromUrlToTemp(rawVideoUrl, 'mp4');

      // 2) FFmpeg CLI: redimensiona/enquadra para o aspect ratio pedido no briefing.
      croppedPath = await this.ffmpeg.cropToAspectRatio({ inputPath: rawPath, aspectRatio });
      const finalBuffer = await this.ffmpeg.readAndCleanup(croppedPath);
      croppedPath = null; // já foi lido e removido por readAndCleanup

      // 3) Upload do arquivo final no S3/MinIO, registrado como media_asset.
      const asset = await this.mediaAssets.uploadAndRegister({
        tenantId,
        buffer: finalBuffer,
        contentType: 'video/mp4',
        fileType: 'video/mp4',
        engineSource: 'MOTION_GRAPHICS',
        extraMetadata: { source: 'ai_generation_job', ai_generation_job_id: aiGenerationJobId, aspect_ratio: aspectRatio },
      });

      aiJob.status = 'DONE';
      aiJob.final_asset_id = asset.id;
      await this.aiJobs.save(aiJob);
      this.logger.log(`ai_generation_job ${aiGenerationJobId} finalizado — media_asset ${asset.id}.`);
    } catch (err) {
      aiJob.status = 'FAILED';
      aiJob.error_message = (err as Error).message;
      await this.aiJobs.save(aiJob);
      this.logger.error(`Falha no pós-processamento do ai_generation_job ${aiGenerationJobId}: ${(err as Error).message}`);
      throw err; // deixa o BullMQ aplicar sua política de retry/backoff padrão
    } finally {
      if (rawPath) await this.ffmpeg.readAndCleanup(rawPath).catch(() => undefined);
      if (croppedPath) await this.ffmpeg.readAndCleanup(croppedPath).catch(() => undefined);
    }
  }
}
