import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { MediaAsset } from '../media-assets/media-asset.entity';

/** Os 3 portões definidos em Mestre_01 / Volume_1 §2 e §5. */
export type GateStage = 'BRAND_COMPLIANCE' | 'AUDIOVISUAL_QUALITY' | 'TONE_TEXT';
export type GateStatus = 'PASSED' | 'FAILED';

/**
 * Tabela `audit_gate_logs` (M10 Audit Gates) — schema idêntico ao
 * Documento Mestre 02 §2.3 / Blueprint Executivo Volume 3 §1.3.
 */
@Entity('audit_gate_logs')
export class AuditGateLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => MediaAsset, { nullable: true })
  @JoinColumn({ name: 'asset_id' })
  asset: MediaAsset | null;

  @Column({ type: 'uuid', nullable: true })
  asset_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  gate_stage: GateStage;

  @Column({ type: 'varchar', length: 20 })
  status: GateStatus;

  @Column({ type: 'numeric', precision: 4, scale: 2, nullable: true })
  qa_score: number | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  /**
   * Breakdown auditável dos critérios que compuseram o score (label, ok, detalhe, peso).
   * Extensão prática ao schema original: garante que NENHUMA nota seja caixa-preta,
   * requisito citado no doc mestre (RNF04 — Auditabilidade).
   */
  @Column({ type: 'jsonb', nullable: true })
  checks: unknown;

  @CreateDateColumn({ type: 'timestamptz' })
  audited_at: Date;
}
