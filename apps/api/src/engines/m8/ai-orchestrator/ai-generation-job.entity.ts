import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Tenant } from '../../../tenants/tenant.entity';

/** Provedores de geração de vídeo suportados: Kling (Kuaishou) e MiniMax (Hailuo). */
export type AiProvider = 'kling' | 'minimax';
export type AiGenerationStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

/**
 * Tabela `ai_generation_jobs` — Geração de Vídeo Assíncrona + Resiliência (IA).
 *
 * A API aceita a requisição, cria esta linha com status PENDING e responde
 * 202 Accepted imediatamente. O provedor (Kling ou, em fallback, MiniMax)
 * processa em background e chama `POST /api/v1/webhooks/ai-video` quando
 * termina — o WebhooksController localiza o job por `external_job_id` e
 * atualiza esta linha, então enfileira o `video-render.worker.ts` (BullMQ)
 * para o pós-processamento de aspect ratio.
 */
@Entity('ai_generation_jobs')
export class AiGenerationJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 20 })
  provider: AiProvider;

  /** id do prediction/job no provedor externo — usado para casar o webhook com este registro. */
  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  external_job_id: string | null;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ type: 'varchar', length: 10 })
  aspect_ratio: '9:16' | '16:9' | '1:1';

  @Column({ type: 'jsonb', nullable: true })
  brand_kit: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: AiGenerationStatus;

  /** URL do vídeo bruto gerado pelo provedor — preenchida quando o webhook chega. */
  @Column({ type: 'text', nullable: true })
  raw_result_url: string | null;

  /** id do media_asset final (já cortado no aspect ratio e no S3), após o video-render.worker.ts. */
  @Column({ type: 'uuid', nullable: true })
  final_asset_id: string | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  /**
   * BLINDAGEM FINANCEIRA (ver migration AddQuotaChargeTrackingToAiGenerationJobs):
   * `true` quando este job já debitou 1 unidade de cota do tenant
   * (`UsageService.consume`) no momento da submissão ao provedor —
   * `AiOrchestratorService.submit()` só chega a chamar Kling/MiniMax depois
   * de confirmar isso. `quota_charged_extra_credit` distingue se o débito
   * caiu na cota mensal do plano ou no saldo de crédito avulso
   * (AVULSO/PACOTE5), pra `markFailed()` saber pra qual dos dois devolver.
   * `quota_refunded` evita estorno duplicado em reenvio de webhook do
   * provedor.
   */
  @Column({ type: 'boolean', default: false })
  quota_charged: boolean;

  @Column({ type: 'boolean', default: false })
  quota_charged_extra_credit: boolean;

  @Column({ type: 'boolean', default: false })
  quota_refunded: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
