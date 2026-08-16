import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';

/**
 * Tabela `scripts` — Lacuna 1: ScriptGeneratorService.
 *
 * Guarda tanto o briefing recebido do cliente quanto o `contract` JSON
 * estruturado devolvido pelo LLM (hook, roteiro por segmentos, CTA, legenda
 * social, hashtags). O `render_jobs.script_id` (contrato original do M8,
 * Blueprint Vol.3 §2) pode apontar para o `id` desta tabela, fechando o
 * fluxo: gerar roteiro → usar o id no render do M8.
 */
@Entity('scripts')
export class Script {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 50 })
  niche: string;

  @Column({ type: 'varchar', length: 50 })
  platform: string;

  @Column({ type: 'text' })
  brief: string;

  /** Contrato JSON estruturado: { hook, roteiro[], cta, legenda_social, hashtags[] }. */
  @Column({ type: 'jsonb' })
  contract: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: 'DONE' })
  status: 'DONE' | 'FAILED';

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
