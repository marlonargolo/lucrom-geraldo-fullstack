import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { GraphicSlideLayers, GraphicCompositionSnapshot } from './graphic-layer.types';

export type GraphicFormat = '1080x1350' | '1080x1920';
export type GraphicKind = 'carousel' | 'static_art';

/**
 * Tabela `graphic_compositions` — Lacuna 2: GraphicComposerService.
 * Cada linha é uma peça gráfica (carrossel com N slides ou arte estática
 * única) renderizada via Puppeteer/HTML-to-Image, com os `media_assets.id`
 * de cada slide/arte gerado.
 */
@Entity('graphic_compositions')
export class GraphicComposition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 20 })
  kind: GraphicKind;

  @Column({ type: 'varchar', length: 20 })
  format: GraphicFormat;

  /** ids dos media_assets de cada slide (1 item se `static_art`, N se `carousel`). */
  @Column({ type: 'jsonb' })
  output_asset_ids: string[];

  /** Snapshot da paleta/tipografia usadas (auditoria de brand compliance). */
  @Column({ type: 'jsonb', nullable: true })
  brand_kit_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'DONE' })
  status: 'DONE' | 'FAILED';

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  /**
   * Módulo Ajuste Rápido Humano — artefato estruturado por slide, mantido
   * ao lado do PNG achatado em `output_asset_ids`. `nullable: true` porque
   * composições criadas antes deste módulo não têm camadas (ver checagem
   * em `updateLayers()`); toda composição nova a partir daqui sempre grava.
   */
  @Column({ type: 'jsonb', nullable: true })
  layers: GraphicSlideLayers[] | null;

  /** Incrementada a cada `updateLayers()` — nunca em `compose()` (v1 é o próprio nascimento da peça). */
  @Column({ type: 'int', default: 1 })
  version: number;

  /** Histórico de versões anteriores (mais recente primeiro). Vazio até o primeiro ajuste. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  history: GraphicCompositionSnapshot[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
