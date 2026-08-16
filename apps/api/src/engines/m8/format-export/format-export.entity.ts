import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tenant } from '../../../tenants/tenant.entity';
import { MediaAsset } from '../../../media-assets/media-asset.entity';

export type ExportFormatKind = 'reels' | 'story' | 'feed_square' | 'feed_portrait' | 'carousel';
export type FormatExportOverallStatus = 'DONE' | 'PARTIAL' | 'FAILED';

/** Resultado de UM formato dentro de um pedido de export multi-formato. */
export interface FormatExportResult {
  format: ExportFormatKind;
  status: 'DONE' | 'FAILED';
  /** Reels/Story/Feed (vídeo recortado): id do media_asset gerado. */
  output_asset_id?: string | null;
  /** Carrossel (Puppeteer): ids dos media_assets de cada slide. */
  output_asset_ids?: string[] | null;
  error_message?: string | null;
}

/**
 * Tabela `format_exports` — Export automático multi-formato: a partir de uma
 * mesma peça já gerada (`source_asset`, tipicamente o `output_asset` de um
 * `render_jobs`), gera de uma vez as variantes Reels (9:16), Story (9:16),
 * Feed quadrado (1:1), Feed retrato (4:5) — via `FfmpegService.cropToAspectRatio`
 * — e Carrossel — via `GraphicComposerService.compose()`, puxando o texto
 * automaticamente do `Script.contract` (hook/roteiro/cta).
 *
 * Cada formato processa de forma independente: a falha de um não impede os
 * demais (ver `results`, com um status por formato). `status` aqui é o
 * resumo geral: DONE (todos ok), PARTIAL (alguns falharam), FAILED (todos falharam).
 */
@Entity('format_exports')
export class FormatExport {
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

  /** id do `scripts.id` cujo `contract` (hook/roteiro/cta) alimenta o slide do carrossel, quando pedido. */
  @Column({ type: 'uuid', nullable: true })
  script_id: string | null;

  @Column({ type: 'jsonb' })
  requested_formats: ExportFormatKind[];

  @Column({ type: 'jsonb' })
  results: FormatExportResult[];

  @Column({ type: 'varchar', length: 20 })
  status: FormatExportOverallStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
