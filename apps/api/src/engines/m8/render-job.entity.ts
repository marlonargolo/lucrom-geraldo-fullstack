import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { MediaAsset } from '../../media-assets/media-asset.entity';

export type RenderJobStatus = 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';

/**
 * Rastreia cada chamada a POST /api/v1/engines/m8/render — não existia no
 * schema original (Blueprint Vol.3), mas é necessária para dar status
 * consultável ao cliente (o contrato de API do doc mestre não define como
 * o resultado assíncrono é consultado; esta tabela resolve isso).
 */
@Entity('render_jobs')
export class RenderJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  /** script_id do contrato de API original (referência lógica, sem tabela de roteiros ainda). */
  @Column({ type: 'uuid' })
  script_id: string;

  @ManyToOne(() => MediaAsset)
  @JoinColumn({ name: 'raw_asset_id' })
  raw_asset: MediaAsset;

  @Column({ type: 'uuid' })
  raw_asset_id: string;

  @ManyToOne(() => MediaAsset, { nullable: true })
  @JoinColumn({ name: 'output_asset_id' })
  output_asset: MediaAsset | null;

  @Column({ type: 'uuid', nullable: true })
  output_asset_id: string | null;

  /** enable_relighting, enable_lip_sync (não implementado — é generativo), subtitles_style, background_denoise. */
  @Column({ type: 'jsonb' })
  pipeline_options: Record<string, unknown>;

  /** Brand kit usado para o gate de marca (paleta hex, termos proibidos etc.), snapshot para auditoria. */
  @Column({ type: 'jsonb', nullable: true })
  brand_kit_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'QUEUED' })
  status: RenderJobStatus;

  /** ID do job no BullMQ, para correlacionar com a fila. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  queue_job_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  queue_name: string;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
