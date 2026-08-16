import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { BrandKit } from '../../brand/entities/brand-kit.entity';

/**
 * Director Engine — orquestrador de sessão de produção.
 *
 * Referenciado pelo frontend (`lib/production/real-production-client.ts`,
 * `components/studio/real-pipeline-panel.tsx`) mas nunca entregue em nenhum
 * dos pacotes recebidos até agora (ver `CHANGELOG-UNIFICACAO.md`, seção
 * "Fora do escopo desta entrega"). Esta entidade é a máquina de estágios
 * central: cada avanço (`business` → `strategy` → `creative` → `production`)
 * cria um registro filho (BusinessTicket/StrategyBrief/CreativeManifest/
 * ProductionContract) e grava o `id` dele aqui, nunca o inverso — o
 * `ProjectSession` é sempre a fonte da verdade do estágio atual.
 *
 * QUALITY e DONE existem no enum por completude de domínio, mas — assim como
 * o comentário do `real-production-client.ts` já avisa — não têm rota de
 * avanço implementada ainda (não há "Quality Engine"/"Learning Engine"
 * entregue). `ABORTED` é o único estágio terminal alcançável hoje, decidido
 * pelo Business Engine quando o score de viabilidade fica abaixo do limiar.
 */
export type ProjectStage =
  | 'CREATED'
  | 'BUSINESS'
  | 'STRATEGY'
  | 'CREATIVE'
  | 'PRODUCTION'
  | 'QUALITY'
  | 'DONE'
  | 'ABORTED';

@Entity('project_sessions')
export class ProjectSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  /** Nunca aceito do cliente — sempre derivado do `brand_id` na criação (BrandKit.tenant_id). Isolamento de tenant. */
  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => BrandKit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brand_id' })
  brand: BrandKit;

  @Index()
  @Column({ type: 'uuid' })
  brand_id: string;

  @Column({ type: 'varchar', length: 20, default: 'CREATED' })
  current_stage: ProjectStage;

  @Column({ type: 'uuid', nullable: true })
  business_ticket_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  strategy_brief_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  creative_manifest_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  render_job_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  quality_audit_id: string | null;

  @Column({ type: 'text', nullable: true })
  abort_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
