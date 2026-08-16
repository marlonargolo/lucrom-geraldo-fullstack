import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PlanTier } from '../tenants/tenant.entity';

export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded';
export type PaymentProvider = 'mercadopago';
export type PaymentMethod = 'pix' | 'card';
/** 'PLAN' = upgrade de assinatura (usa `plan_requested`). 'AVULSO'/'PACOTE5' = compra única de créditos (usa `credits_granted`). */
export type PaymentProductType = 'PLAN' | 'AVULSO' | 'PACOTE5';

/**
 * Billing & Checkout. Uma linha por tentativa de upgrade de plano. Criada ANTES de chamar o gateway de pagamento — o `id`
 * gerado aqui vira o `external_reference` enviado ao Mercado Pago, então o
 * webhook consegue achar o tenant certo mesmo que o `id` do pagamento no
 * Mercado Pago (`provider_payment_id`) só seja conhecido depois.
 *
 * Idempotência: `status` começa 'pending' e só transiciona uma vez pra
 * 'approved'/'rejected' — BillingService.confirmPayment() checa o status
 * atual antes de agir, então um webhook duplicado (a Meta/Mercado Pago
 * podem reenviar) nunca promove o tenant duas vezes.
 */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  tenant_id: string;

  @Column({ type: 'varchar', length: 30, default: 'mercadopago' })
  provider: PaymentProvider;

  @Column({ type: 'varchar', length: 20, nullable: true })
  method: PaymentMethod | null;

  /** ID do pagamento no gateway externo (ex.: payment.id do Mercado Pago). Nulo até o gateway responder. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  external_id: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: PaymentStatus;

  /** Só é significativo quando `product_type` = 'PLAN'; para compras avulsas fica com o valor default ('CREATOR', sem efeito). */
  @Column({ type: 'varchar', length: 30 })
  plan_requested: PlanTier;

  @Column({ type: 'varchar', length: 20, default: 'PLAN' })
  product_type: PaymentProductType;

  /** Só é significativo quando `product_type` != 'PLAN' — quantos créditos de vídeo somar a `tenants.extra_video_credits` na aprovação. */
  @Column({ type: 'int', default: 0 })
  credits_granted: number;

  @Column({ type: 'int' })
  amount_cents: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
