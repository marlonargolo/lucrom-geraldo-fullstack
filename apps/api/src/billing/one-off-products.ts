/**
 * Catálogo de produtos de COMPRA ÚNICA (fora do ciclo de assinatura
 * mensal dos planos CREATOR/PRO/ENTERPRISE — ver usage.service.ts).
 *
 * BLINDAGEM FINANCEIRA: o preço e os créditos concedidos aqui são a ÚNICA
 * fonte de verdade. O backend NUNCA aceita `amountCents` ou `credits`
 * vindos do corpo da requisição do cliente para produtos avulsos — ver
 * BillingController.createIntent, que resolve o valor a partir deste
 * catálogo pelo `productCode`, ignorando qualquer preço enviado pelo
 * front-end. Isso fecha a brecha clássica de "o usuário manipula o preço
 * no DevTools antes de enviar o checkout".
 *
 * Se o valor mudar, ajuste SOMENTE aqui — e mantenha em sincronia manual
 * com os textos exibidos em apps/web/app/page.tsx (PLAN_AVULSO_PRICE /
 * PLAN_PACOTE5_PRICE), do mesmo jeito que PLAN_CREATOR_LIMIT precisa ficar
 * sincronizado com PLAN_QUOTA_LIMITS.CREATOR em usage.service.ts.
 */
export type OneOffProductCode = 'AVULSO' | 'PACOTE5';

export interface OneOffProduct {
  code: OneOffProductCode;
  label: string;
  /** Quantidade de vídeos (créditos) concedidos ao tenant quando o pagamento é aprovado. */
  credits: number;
  amountCents: number;
}

export const ONE_OFF_PRODUCTS: Record<OneOffProductCode, OneOffProduct> = {
  // Compra avulsa: 1 vídeo de 60s, R$ 39,90.
  AVULSO: {
    code: 'AVULSO',
    label: 'Vídeo avulso',
    credits: 1,
    amountCents: 3990,
  },
  // Pacote fechado: 5 vídeos de 60s, R$ 179,90.
  PACOTE5: {
    code: 'PACOTE5',
    label: 'Pacote de 5 vídeos (60s)',
    credits: 5,
    amountCents: 17_990,
  },
};

export function isOneOffProductCode(value: unknown): value is OneOffProductCode {
  return value === 'AVULSO' || value === 'PACOTE5';
}
