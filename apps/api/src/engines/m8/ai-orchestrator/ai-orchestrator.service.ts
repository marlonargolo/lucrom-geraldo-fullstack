import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../../tenants/tenant.entity';
import { KlingClientService } from './kling-client.service';
import { MinimaxClientService } from './minimax-client.service';
import { AiGenerationJob, AiProvider } from './ai-generation-job.entity';
import { GenerateVideoAsyncDto } from './dto/generate-video-async.dto';
import { RedisService } from '../../../common/redis/redis.service';
import { UsageService } from '../../../usage/usage.service';
import { QuotaExceededException } from '../../../common/exceptions/quota-exceeded.exception';

/**
 * Resiliência na IA (Circuit Breaker) — Kling (Kuaishou) é o provedor primário.
 * Após `circuitBreakerThreshold` (padrão 3) falhas consecutivas ao enfileirar
 * no Kling, o circuito abre e as próximas submissões vão direto para a
 * MiniMax (fallback), sem tentar o Kling — até `circuitBreakerCooldownMs`
 * (padrão 60s) se passarem sem novas falhas, quando o circuito fecha de novo
 * e volta a tentar o Kling como primário.
 *
 * O serviço fala diretamente com as APIs oficiais da Kling
 * (kling-client.service.ts) e da MiniMax (minimax-client.service.ts),
 * sem intermediários.
 *
 * Estado do circuito vive no Redis (via RedisService), não em memória do
 * processo: com múltiplas réplicas da API atrás de um load balancer, cada
 * instância precisa enxergar o mesmo estado de falhas/circuito aberto, ou o
 * padrão perde o efeito (uma réplica poderia achar o circuito fechado
 * enquanto outra já registrou 3 falhas consecutivas).
 */
const CIRCUIT_FAILURES_KEY = 'ai-orchestrator:kling:failures';
const CIRCUIT_OPEN_KEY = 'ai-orchestrator:kling:open';

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  private readonly klingModel: string;
  private readonly minimaxModel: string;
  private readonly circuitBreakerThreshold: number;
  private readonly circuitBreakerCooldownMs: number;
  private readonly publicWebhookBaseUrl: string;

  constructor(
    @InjectRepository(AiGenerationJob) private readonly jobs: Repository<AiGenerationJob>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly kling: KlingClientService,
    private readonly minimax: MinimaxClientService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly usage: UsageService,
  ) {
    this.klingModel = this.config.get<string>('aiOrchestrator.klingModel') ?? 'kling-v1';
    this.minimaxModel = this.config.get<string>('minimax.model') ?? 'MiniMax-Hailuo-2.3';
    this.circuitBreakerThreshold = this.config.get<number>('aiOrchestrator.circuitBreakerThreshold') ?? 3;
    this.circuitBreakerCooldownMs = this.config.get<number>('aiOrchestrator.circuitBreakerCooldownMs') ?? 60_000;
    this.publicWebhookBaseUrl = this.config.get<string>('aiOrchestrator.publicWebhookBaseUrl') ?? 'http://localhost:3000';
  }

  /**
   * Aceita a requisição e retorna IMEDIATAMENTE (o controller responde 202).
   * O resultado chega depois via `POST /api/v1/webhooks/ai-video`.
   *
   * BLINDAGEM FINANCEIRA — ÚNICO PONTO DE ENTRADA para Kling/MiniMax (custo
   * real por chamada): tanto o Director Engine (sessions/:id/production)
   * quanto o endpoint legado `POST /api/v1/engines/m8/ai-video/generate`
   * (briefing-composer.tsx) chamam este método, então a trava de cota vive
   * AQUI — no menor denominador comum — em vez de duplicada (e
   * possivelmente esquecida) em cada chamador. `UsageService.consume()` é
   * chamado e CONFIRMADO `allowed: true` antes de qualquer requisição sair
   * pro provedor: se a cota (mensal + créditos avulsos) já estourou,
   * lançamos `QuotaExceededException` (402) e nem chegamos a criar o job.
   */
  async submit(dto: GenerateVideoAsyncDto): Promise<AiGenerationJob> {
    const tenant = await this.tenants.findOne({ where: { id: dto.tenant_id } });
    if (!tenant) throw new BadRequestException(`Tenant ${dto.tenant_id} não encontrado.`);

    const quota = await this.usage.consume(dto.tenant_id);
    if (!quota.allowed) {
      throw new QuotaExceededException(quota);
    }

    const job = this.jobs.create({
      tenant_id: dto.tenant_id,
      provider: 'kling',
      external_job_id: null,
      prompt: dto.prompt,
      aspect_ratio: dto.aspect_ratio,
      // Mesmo cast de graphic-composer.service.ts: BrandKitDto (classe) não
      // é estruturalmente atribuível a Record<string, unknown> pro
      // DeepPartial do TypeORM, mesmo sendo um objeto JSON válido em runtime.
      brand_kit: (dto.brand_kit as unknown as Record<string, unknown>) ?? null,
      status: 'PENDING',
      // A cota JÁ foi debitada acima (atômico, no Postgres) — registramos
      // aqui COMO, pra `markFailed()` saber pra qual saldo estornar se o
      // provedor falhar depois.
      quota_charged: true,
      quota_charged_extra_credit: quota.usedExtraCredit ?? false,
    });
    await this.jobs.save(job);

    const webhookUrl = `${this.publicWebhookBaseUrl}/api/v1/webhooks/ai-video`;

    try {
      if (await this.shouldUseKling()) {
        await this.submitToKling(job, webhookUrl);
      } else {
        await this.submitToMinimax(job, webhookUrl);
      }
    } catch (err) {
      // A submissão em si falhou nos dois provedores — marca o job como
      // falho E ESTORNA a cota debitada acima (o tenant não deve pagar por
      // um vídeo que nunca chegou a ser processado). Ainda assim retorna
      // 202 pro controller — o erro fica visível via
      // GET /api/v1/engines/m8/ai-video/:id, consistente com o padrão
      // assíncrono.
      await this.markFailed(job, (err as Error).message);
    }

    return job;
  }

  /**
   * Marca o job como FAILED e estorna a cota debitada em `submit()`, se
   * ainda não estornada (idempotente via `quota_refunded` — necessário
   * porque Kling/MiniMax reenviam webhook até receberem 2xx, e este método
   * também é chamado pelo WebhooksController quando o provedor reporta
   * falha de forma assíncrona).
   */
  async markFailed(job: AiGenerationJob, errorMessage: string): Promise<void> {
    job.status = 'FAILED';
    job.error_message = errorMessage;
    await this.jobs.save(job);

    if (!job.quota_charged || job.quota_refunded) return;
    try {
      await this.usage.refund(job.tenant_id, job.quota_charged_extra_credit);
      job.quota_refunded = true;
      await this.jobs.save(job);
      this.logger.log(`Cota estornada pro tenant ${job.tenant_id} (job ${job.id} falhou no provedor).`);
    } catch (refundErr) {
      // Nunca deixar uma falha no estorno mascarar a falha original do
      // provedor (já registrada acima) — só loga; um estorno perdido é
      // recuperável manualmente, um job preso em estado inconsistente não.
      this.logger.error(`Falha ao estornar cota do job ${job.id}: ${(refundErr as Error).message}`);
    }
  }

  /**
   * `tenantId` é obrigatório e é a fonte de isolamento em si — filtra a
   * busca no banco, não é uma checagem posterior. Sem isso, qualquer
   * chamador que soubesse o UUID de um job de outro tenant conseguiria
   * lê-lo (ver auditoria de isolamento multi-tenant).
   */
  findOneOrFail(id: string, tenantId: string) {
    return this.jobs.findOneOrFail({ where: { id, tenant_id: tenantId } });
  }

  findByTenant(tenantId: string) {
    return this.jobs.find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' } });
  }

  /** Usado pelo WebhooksController para localizar o job pelo id externo do provedor. */
  findByExternalJobId(provider: AiProvider, externalJobId: string) {
    return this.jobs.findOne({ where: { provider, external_job_id: externalJobId } });
  }

  save(job: AiGenerationJob) {
    return this.jobs.save(job);
  }

  // ─── Circuit breaker (estado compartilhado via Redis entre réplicas) ───

  /**
   * O circuito é considerado aberto simplesmente pela presença da chave
   * `CIRCUIT_OPEN_KEY` no Redis — ela é criada com TTL igual a
   * `circuitBreakerCooldownMs` em `recordKlingFailure()`, então o cooldown
   * expira sozinho (não precisamos calcular "tempo decorrido" manualmente,
   * o Redis já expira a chave por nós).
   */
  private async shouldUseKling(): Promise<boolean> {
    const isOpen = await this.redis.get(CIRCUIT_OPEN_KEY);
    return isOpen == null;
  }

  private async recordKlingSuccess(): Promise<void> {
    await this.redis.del(CIRCUIT_FAILURES_KEY);
    await this.redis.del(CIRCUIT_OPEN_KEY);
  }

  private async recordKlingFailure(): Promise<void> {
    const failures = await this.redis.incrWithWindowMs(CIRCUIT_FAILURES_KEY, this.circuitBreakerCooldownMs);
    this.logger.warn(`Kling falhou (${failures}/${this.circuitBreakerThreshold} falhas consecutivas).`);
    if (failures >= this.circuitBreakerThreshold) {
      await this.redis.setWithTtlMs(CIRCUIT_OPEN_KEY, '1', this.circuitBreakerCooldownMs);
      this.logger.warn(
        `Circuit breaker ABERTO — próximas submissões (de qualquer réplica) vão direto para a MiniMax por ${this.circuitBreakerCooldownMs}ms.`,
      );
    }
  }

  // ─── Provedores (ambos chineses, sem intermediário) ────────────────────

  private async submitToKling(job: AiGenerationJob, webhookUrl: string): Promise<void> {
    if (!this.kling.isConfigured) {
      await this.recordKlingFailure();
      throw new Error('KLING_ACCESS_KEY_ID/KLING_ACCESS_KEY_SECRET não configurados — indo para o fallback.');
    }

    try {
      const { taskId } = await this.kling.submitTextToVideo({
        model: this.klingModel,
        prompt: job.prompt,
        aspectRatio: job.aspect_ratio,
        callbackUrl: `${webhookUrl}?provider=kling`,
      });

      job.provider = 'kling';
      job.external_job_id = taskId;
      job.status = 'PROCESSING';
      await this.jobs.save(job);
      await this.recordKlingSuccess();
    } catch (err) {
      await this.recordKlingFailure();
      this.logger.warn(`Kling indisponível, acionando fallback pra MiniMax: ${(err as Error).message}`);
      await this.submitToMinimax(job, webhookUrl);
    }
  }

  private async submitToMinimax(job: AiGenerationJob, webhookUrl: string): Promise<void> {
    const { taskId } = await this.minimax.submitTextToVideo({
      model: this.minimaxModel,
      prompt: job.prompt,
      callbackUrl: `${webhookUrl}?provider=minimax`,
    });

    job.provider = 'minimax';
    job.external_job_id = taskId;
    job.status = 'PROCESSING';
    await this.jobs.save(job);
  }
}
