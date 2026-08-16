import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tenant } from '../../../tenants/tenant.entity';
import { MediaAsset } from '../../../media-assets/media-asset.entity';

export type VideoEditStatus = 'DONE' | 'FAILED';

/**
 * Tabela `video_edits` — Edição pós-geração: corta um vídeo já renderizado
 * (`source_asset`, tipicamente o `output_asset` de um `render_jobs`) entre
 * `start_time_seconds` e `end_time_seconds`, com legenda opcional (reaproveita
 * `FfmpegService.renderLowerThird`, já usado pelo motor de Motion Graphics).
 *
 * Não-destrutivo por design: o `source_asset` nunca é sobrescrito. Cada
 * edição gera um novo `output_asset` (engine_source = 'VIDEO_EDIT'), então o
 * tenant mantém histórico de versões e pode refazer o corte a partir do
 * original quantas vezes quiser.
 */
@Entity('video_edits')
export class VideoEdit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => MediaAsset)
  @JoinColumn({ name: 'source_asset_id' })
  source_asset: MediaAsset;

  @Column({ type: 'uuid' })
  source_asset_id: string;

  @ManyToOne(() => MediaAsset, { nullable: true })
  @JoinColumn({ name: 'output_asset_id' })
  output_asset: MediaAsset | null;

  @Column({ type: 'uuid', nullable: true })
  output_asset_id: string | null;

  @Column({ type: 'real' })
  start_time_seconds: number;

  @Column({ type: 'real' })
  end_time_seconds: number;

  /** Legenda (lower third) aplicada, se houver: { title, subtitle?, accent_color?, text_color?, start_time_seconds?, end_time_seconds? }. */
  @Column({ type: 'jsonb', nullable: true })
  caption: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'DONE' })
  status: VideoEditStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
