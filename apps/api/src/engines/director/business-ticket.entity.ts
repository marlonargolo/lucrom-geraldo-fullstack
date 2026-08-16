import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type BusinessProblemCategory = 'HIGH_CAC' | 'LOW_AWARENESS' | 'POOR_CONVERSION' | 'BRAND_EROSION';

/**
 * Saída do Business Engine — "vale a pena produzir isso?". Guarda o
 * `viability_score` calculado (ver `DirectorService.scoreBusinessTicket`)
 * pra auditoria/aprendizado futuro (rastreável mesmo quando a sessão segue
 * pra STRATEGY), não só a decisão binária.
 */
@Entity('business_tickets')
export class BusinessTicket {
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

  @Column({ type: 'varchar', length: 30 })
  problem_category: BusinessProblemCategory;

  @Column({ type: 'text' })
  problem_description: string;

  @Column({ type: 'varchar', length: 200 })
  target_metric: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  current_value: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  target_value: string | null;

  /** 0-100 — ver regra de cálculo em DirectorService. Abaixo do limiar (50), a sessão vai pra ABORTED. */
  @Column({ type: 'integer' })
  viability_score: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
