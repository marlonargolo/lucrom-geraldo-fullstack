import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PlanTier = 'CREATOR' | 'PRO' | 'ENTERPRISE';

/**
 * Tabela `tenants` — schema idêntico ao especificado em:
 * Documento Mestre 02 §2.1 / Blueprint Executivo Volume 3 §1.1
 */
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: 'CREATOR' })
  plan_tier: PlanTier;

  /**
   * Controle de Cotas de Negócio (ver `UsageService.consume`/`.peek`) —
   * contador de gerações de IA no mês corrente de `usage_period_start`.
   * Zerado/realocado atomicamente pelo próprio UPDATE de `UsageService.consume`
   * quando o mês vira, então o default aqui só cobre a criação do tenant.
   */
  @Column({ type: 'integer', default: 0 })
  monthly_ai_generations: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  usage_period_start: Date;

  /**
   * Saldo de vídeos comprados avulsos (produto AVULSO ou PACOTE5 — ver
   * billing/one-off-products.ts). Consumido SOMENTE depois que a cota
   * mensal do plano já se esgotou (ver UsageService.consume) e, ao
   * contrário de `monthly_ai_generations`, NÃO zera na virada do mês.
   */
  @Column({ type: 'integer', default: 0 })
  extra_video_credits: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
