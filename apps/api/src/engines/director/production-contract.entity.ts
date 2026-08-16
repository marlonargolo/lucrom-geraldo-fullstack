import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Ponte Creative → Production. Ao ser criado, dispara a geração de vídeo
 * real via `AiOrchestratorService` (Kling primário, MiniMax fallback),
 * usando o roteiro do Creative Manifest como prompt — o mesmo pipeline
 * assíncrono usado por `/api/v1/engines/m8/ai-video` (ver
 * DirectorService.advanceProduction). `ai_generation_job_id` aponta pra
 * linha em `ai_generation_jobs` que carrega o progresso real (PENDING →
 * PROCESSING → DONE/FAILED), consultável em
 * GET /api/v1/engines/m8/ai-video/:id.
 */
@Entity('production_contracts')
export class ProductionContract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  session_id: string;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid' })
  brand_id: string;

  @Column({ type: 'uuid' })
  creative_manifest_id: string;

  @Column({ type: 'uuid' })
  script_id: string;

  /** Linha em `ai_generation_jobs` que executa a geração real (null só se o disparo falhou antes de criar o job). */
  @Column({ type: 'uuid', nullable: true })
  ai_generation_job_id: string | null;

  /**
   * READY: contrato empacotado, geração ainda não disparada (não deveria
   * durar — disparo acontece na mesma chamada que cria o contrato).
   * GENERATING: job de IA criado, progresso em ai_generation_jobs.status.
   * DISPATCH_FAILED: nem chegou a criar o job de IA (ex.: tenant inválido).
   */
  @Column({ type: 'varchar', length: 20, default: 'READY' })
  status: 'READY' | 'GENERATING' | 'DISPATCH_FAILED';

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
