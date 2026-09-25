/**
 * Catálogo de planos de ASSINATURA pagos (PRO/PLUS).
 *
 * BLINDAGEM FINANCEIRA: igual a one-off-products.ts — o preço cobrado vem
 * SEMPRE daqui, nunca do corpo da requisição. BillingController ignora
 * qualquer `amountCents` enviado pelo cliente para planos.
 *
 * Manter em sincronia manual com os textos de apps/web/app/page.tsx
 * (PLAN_PRO_PRICE / PLAN_PLUS_PRICE) e com PLAN_QUOTA_LIMITS em
 * usage/usage.service.ts (gerações por mês).
 */
export type PaidPlanCode = 'PRO' | 'PLUS';

export interface PlanProduct {
  code: PaidPlanCode;
  label: string;
  amountCents: number;
}

export const PLAN_PRODUCTS: Record<PaidPlanCode, PlanProduct> = {
  // 5 vídeos de IA por mês, R$ 119,00/mês.
  PRO: { code: 'PRO', label: 'Plano PRO (mensal)', amountCents: 11_900 },
  // 15 vídeos de IA por mês, R$ 329,00/mês.
  PLUS: { code: 'PLUS', label: 'Plano PLUS (mensal)', amountCents: 32_900 },
};
