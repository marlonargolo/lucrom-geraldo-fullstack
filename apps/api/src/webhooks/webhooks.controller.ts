import { Body, Controller, HttpCode, HttpStatus, Logger, Post, Query } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_VIDEO_RENDER, VideoRenderJobData } from '../queue/queue.constants';
import { AiOrchestratorService } from '../engines/m8/ai-orchestrator/ai-orchestrator.service';
import { MinimaxClientService } from '../engines/m8/ai-orchestrator/minimax-client.service';
import { AiProvider } from '../engines/m8/ai-orchestrator/ai-generation-job.entity';

/**
 * `POST /api/v1/webhooks/ai-video` — callback assíncrono do Kling e da
 * MiniMax (ver AiOrchestratorService/KlingClientService/MinimaxClientService).
 * Normaliza os payloads nativos das APIs oficiais de cada provedor.
 *
 * Não fica atrás do ApiTokenGuard: provedores externos não têm nosso token.
 * A validação de autenticidade é feita casando `external_job_id` com um
 * `ai_generation_job` PENDING/PROCESSING já existente — payloads que não
 * batem com nenhum job conhecido são silenciosamente ignorados (204), sem
 * vazar informação sobre a existência ou não de jobs.
 *
 * Formatos de payload dos dois provedores são normalizados aqui: cada um tem
 * seu próprio formato de "id do job" e "url do resultado", então este
 * endpoint aceita um query param `?provider=kling|minimax` (configurado na
 * própria URL de callback passada na submissão) para saber como interpretar o body.
 */
@Controller('api/v1/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly orchestrator: AiOrchestratorService,
    private readonly minimax: MinimaxClientService,
    @InjectQueue(QUEUE_VIDEO_RENDER) private readonly videoRenderQueue: Queue<VideoRenderJobData>,
  ) {}

  @Post('ai-video')
  @HttpCode(HttpStatus.NO_CONTENT)
  async aiVideoCallback(
    @Body() body: Record<string, unknown>,
    @Query('provider') providerParam?: string,
  ): Promise<Record<string, unknown> | void> {
    const provider: AiProvider = providerParam === 'minimax' ? 'minimax' : 'kling';

    // Particularidade da MiniMax: na hora de REGISTRAR o callback_url, a
    // MiniMax manda uma requisição de validação com um campo `challenge`
    // que precisa ser ecoado de volta em até 3s — se não, o callback nunca
    // chega a ser registrado. Isso não existe no fluxo da Kling.
    if (provider === 'minimax' && typeof body.challenge !== 'undefined') {
      return { challenge: body.challenge };
    }

    const { externalJobId, status, resultUrl, fileId, errorMessage } = await this.normalizePayload(provider, body);

    if (!externalJobId) {
      this.logger.warn(`Webhook de ${provider} recebido sem id de job identificável — ignorando.`);
      return;
    }

    const job = await this.orchestrator.findByExternalJobId(provider, externalJobId);
    if (!job) {
      this.logger.warn(`Webhook de ${provider} para job externo ${externalJobId} não corresponde a nenhum ai_generation_job conhecido — ignorando.`);
      return;
    }

    if (status === 'FAILED') {
      // markFailed() também estorna a cota debitada na submissão (ver
      // AiOrchestratorService.submit()) — idempotente, então reenvios deste
      // mesmo webhook (comportamento normal do Kling/MiniMax) nunca
      // estornam duas vezes.
      await this.orchestrator.markFailed(job, errorMessage ?? 'Provedor de IA reportou falha na geração.');
      this.logger.error(`ai_generation_job ${job.id} falhou no provedor ${provider}: ${errorMessage ?? '(sem detalhe)'}`);
      return;
    }

    // MiniMax entrega um `file_id` no callback, não a URL final — precisa de
    // uma segunda chamada (files/retrieve) pra resolver a URL de download.
    let finalResultUrl = resultUrl;
    if (status === 'DONE' && !finalResultUrl && fileId && provider === 'minimax') {
      try {
        finalResultUrl = await this.minimax.retrieveFileUrl(fileId);
      } catch (err) {
        await this.orchestrator.markFailed(job, `Falha ao resolver file_id da MiniMax: ${(err as Error).message}`);
        this.logger.error(`ai_generation_job ${job.id}: falha ao resolver file_id da MiniMax.`);
        return;
      }
    }

    if (status !== 'DONE' || !finalResultUrl) {
      // Webhook intermediário (ex.: "started"/"processing") — apenas atualiza o status, sem enfileirar ainda.
      job.status = 'PROCESSING';
      await this.orchestrator.save(job);
      return;
    }

    job.raw_result_url = finalResultUrl;
    job.status = 'PROCESSING';
    await this.orchestrator.save(job);

    await this.videoRenderQueue.add('video-render', {
      aiGenerationJobId: job.id,
      tenantId: job.tenant_id,
      rawVideoUrl: finalResultUrl,
      aspectRatio: job.aspect_ratio,
    });

    this.logger.log(`ai_generation_job ${job.id}: resultado recebido do ${provider}, enfileirado em ${QUEUE_VIDEO_RENDER}.`);
  }

  /** Normaliza os formatos distintos de payload da Kling (task2video) e da MiniMax (video_generation). */
  private async normalizePayload(
    provider: AiProvider,
    body: Record<string, unknown>,
  ): Promise<{
    externalJobId: string | null;
    status: 'DONE' | 'FAILED' | 'PROCESSING';
    resultUrl: string | null;
    fileId: string | null;
    errorMessage: string | null;
  }> {
    if (provider === 'minimax') {
      // Payload documentado da MiniMax: { task_id, status, file_id, base_resp: { status_code, status_msg } }
      const status = body.status as string | undefined;
      const baseResp = (body.base_resp as Record<string, unknown>) ?? {};
      const isError = typeof baseResp.status_code === 'number' && baseResp.status_code !== 0;
      return {
        externalJobId: (body.task_id as string) ?? null,
        status: isError || status === 'failed' ? 'FAILED' : status === 'success' ? 'DONE' : 'PROCESSING',
        resultUrl: null,
        fileId: (body.file_id as string) ?? null,
        errorMessage: isError ? ((baseResp.status_msg as string) ?? 'Erro reportado pela MiniMax.') : null,
      };
    }

    // Kling (api-singapore.klingai.com) — payload de callback inclui task_id +
    // task_status ('submitted' | 'processing' | 'succeed' | 'failed') + task_result.videos[0].url.
    const klingStatus = body.task_status as string | undefined;
    const taskResult = (body.task_result as Record<string, unknown>) ?? {};
    const videos = taskResult.videos as Array<Record<string, unknown>> | undefined;
    const resultUrl = (videos?.[0]?.url as string) ?? null;
    return {
      externalJobId: (body.task_id as string) ?? null,
      status: klingStatus === 'succeed' ? 'DONE' : klingStatus === 'failed' ? 'FAILED' : 'PROCESSING',
      resultUrl,
      fileId: null,
      errorMessage: (body.task_status_msg as string) ?? null,
    };
  }
}
