import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_AVATAR_RENDER, AvatarRenderJobData } from '../queue/queue.constants';
import { AvatarOrchestratorService } from '../engines/avatar/avatar-orchestrator.service';

/**
 * `POST /api/v1/webhooks/avatar-video` — callback assíncrono do lip-sync da
 * Kling (`advanced-lip-sync`), consumido por `AvatarOrchestratorService`.
 *
 * Arquivo NOVO e SEPARADO de `webhooks.controller.ts` de propósito — o
 * pedido foi "preservar o código-fonte integralmente", então nenhum arquivo
 * existente é tocado; este endpoint vive na própria rota base
 * `/api/v1/webhooks`, só que registrado por um controller/módulo diferente.
 *
 * Mesma regra de segurança do `WebhooksController` original: não fica atrás
 * do `ApiTokenGuard` (a Kling não tem nosso token) — a validação de
 * autenticidade é casar o `external_task_id` que NÓS geramos com um
 * `avatar_generation_job` conhecido; payloads que não batem são ignorados
 * (204), sem vazar informação sobre a existência ou não de jobs.
 */
@Controller('api/v1/webhooks')
export class AvatarWebhooksController {
  private readonly logger = new Logger(AvatarWebhooksController.name);

  constructor(
    private readonly orchestrator: AvatarOrchestratorService,
    @InjectQueue(QUEUE_AVATAR_RENDER) private readonly avatarRenderQueue: Queue<AvatarRenderJobData>,
  ) {}

  @Post('avatar-video')
  @HttpCode(HttpStatus.NO_CONTENT)
  async avatarVideoCallback(@Body() body: Record<string, unknown>): Promise<void> {
    // Payload de callback da Kling em advanced-lip-sync: mesma forma de
    // task_status ('submitted'|'processing'|'succeed'|'failed') usada em
    // submitTextToVideo (ver webhooks.controller.ts original), mas
    // task_result.videos[0].url aqui é o vídeo COM lip-sync aplicado.
    const externalTaskId = (body.external_task_id as string) ?? null;
    const taskStatus = body.task_status as string | undefined;
    const taskResult = (body.task_result as Record<string, unknown>) ?? {};
    const videos = taskResult.videos as Array<Record<string, unknown>> | undefined;
    const resultUrl = (videos?.[0]?.url as string) ?? null;

    if (!externalTaskId) {
      this.logger.warn('Webhook de avatar-video recebido sem external_task_id — ignorando.');
      return;
    }

    const job = await this.orchestrator.findByExternalTaskId(externalTaskId);
    if (!job) {
      this.logger.warn(`Webhook de avatar-video para task externo ${externalTaskId} não corresponde a nenhum avatar_generation_job conhecido — ignorando.`);
      return;
    }

    if (taskStatus === 'failed') {
      job.status = 'FAILED';
      job.error_message = (body.task_status_msg as string) ?? 'Kling reportou falha no lip-sync.';
      await this.orchestrator.save(job);
      this.logger.error(`avatar_generation_job ${job.id} falhou no lip-sync: ${job.error_message}`);
      return;
    }

    if (taskStatus !== 'succeed' || !resultUrl) {
      // Webhook intermediário (ex.: "submitted"/"processing") — apenas confirma o status, sem enfileirar ainda.
      job.status = 'PROCESSING_LIPSYNC';
      await this.orchestrator.save(job);
      return;
    }

    job.raw_result_url = resultUrl;
    job.status = 'PROCESSING_LIPSYNC';
    await this.orchestrator.save(job);

    await this.avatarRenderQueue.add('avatar-render', {
      avatarGenerationJobId: job.id,
      tenantId: job.tenant_id,
      rawVideoUrl: resultUrl,
      aspectRatio: job.aspect_ratio,
    });

    this.logger.log(`avatar_generation_job ${job.id}: lip-sync concluído pela Kling, enfileirado em ${QUEUE_AVATAR_RENDER}.`);
  }
}
