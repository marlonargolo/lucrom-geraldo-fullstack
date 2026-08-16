import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';

export type AvatarGenerationStatus =
  | 'PENDING'
  | 'SYNTHESIZING_VOICE'
  | 'PROCESSING_LIPSYNC'
  | 'DONE'
  | 'FAILED';

/**
 * Tabela `avatar_generation_jobs` — vídeo final com avatar (rosto real do
 * tenant), voz clonada e lip-sync, 100% Kling + MiniMax.
 *
 * Mesmo padrão assíncrono de `ai_generation_jobs`/`AiOrchestratorService`:
 * a API aceita a requisição, cria esta linha com status PENDING e responde
 * 202 Accepted na hora. O fluxo tem TRÊS chamadas de provedor em sequência:
 *
 *   1) MinimaxClientService.synthesizeSpeech() — texto → áudio na voz
 *      clonada. SÍNCRONO. Status vira SYNTHESIZING_VOICE enquanto roda.
 *   2) StorageService.upload() — o áudio sintetizado precisa de uma URL
 *      pública temporária pra Kling conseguir baixar (mesmo bucket/serviço
 *      já usado pra tudo mais, nenhum storage novo).
 *   3) KlingClientService.submitLipSync() — ASSÍNCRONO. Status vira
 *      PROCESSING_LIPSYNC; resultado chega via
 *      POST /api/v1/webhooks/avatar-video (mesmo mecanismo de callback_url
 *      já usado por submitTextToVideo no ai-orchestrator).
 *
 * `avatar-render.worker.ts` (BullMQ, fila QUEUE_AVATAR_RENDER) faz o
 * pós-processamento final (aspect ratio) reaproveitando `FfmpegService` —
 * sem duplicar nenhuma lógica de FFmpeg já existente.
 */
@Entity('avatar_generation_jobs')
export class AvatarGenerationJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid' })
  avatar_profile_id: string;

  @Column({ type: 'uuid' })
  voice_profile_id: string;

  @Column({ type: 'text' })
  script_text: string;

  /** s3_key do áudio de narração sintetizado pela MiniMax (etapa 1). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  narration_s3_key: string | null;

  @Column({ type: 'varchar', length: 10 })
  aspect_ratio: '9:16' | '16:9' | '1:1';

  /** external_task_id que NÓS geramos e mandamos pro Kling — usado para casar o webhook com este registro (não é o task_id da Kling, ver AvatarWebhooksController). */
  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  external_task_id: string | null;

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: AvatarGenerationStatus;

  /** URL do vídeo com lip-sync (ainda sem crop de aspect ratio) devolvida pela Kling. */
  @Column({ type: 'text', nullable: true })
  raw_result_url: string | null;

  /** id do media_asset final (já cortado no aspect ratio e no S3), após o avatar-render.worker.ts. */
  @Column({ type: 'uuid', nullable: true })
  final_asset_id: string | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
