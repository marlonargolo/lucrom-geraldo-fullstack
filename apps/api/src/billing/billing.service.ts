import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentMethod, PaymentStatus } from './payment.entity';
import { PlanTier } from '../tenants/tenant.entity';
import { UsageService } from '../usage/usage.service';
import { ONE_OFF_PRODUCTS, OneOffProductCode } from './one-off-products';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    private readonly usage: UsageService,
  ) {}

  /**
   * Cria o registro 'pending' ANTES de chamar o Mercado Pago. O `id` gerado
   * aqui é enviado ao gateway como `external_reference` — é assim que o
   * webhook (que só recebe o ID do pagamento no Mercado Pago) sabe qual
   * tenant/pagamento nosso corresponde.
   *
   * Usado para upgrade de ASSINATURA (plano PRO). Para compra avulsa de
   * créditos (AVULSO/PACOTE5), ver `createPendingOneOffPayment` abaixo —
   * são fluxos separados porque a aprovação de cada um afeta uma coisa
   * diferente no tenant (plan_tier vs. extra_video_credits).
   */
  async createPendingPayment(params: {
    tenantId: string;
    plan: PlanTier;
    amountCents: number;
    method: PaymentMethod;
  }): Promise<Payment> {
    const payment = this.payments.create({
      tenant_id: params.tenantId,
      plan_requested: params.plan,
      product_type: 'PLAN',
      amount_cents: params.amountCents,
      method: params.method,
      status: 'pending',
    });
    return this.payments.save(payment);
  }

  /**
   * Cria o registro 'pending' para compra AVULSA (1 vídeo, R$ 39,90) ou
   * PACOTE5 (5 vídeos, R$ 179,90).
   *
   * BLINDAGEM FINANCEIRA: `amountCents` e `credits` NUNCA vêm do chamador
   * (controller) como valor livre — são sempre resolvidos aqui a partir de
   * `ONE_OFF_PRODUCTS[productCode]`, a única fonte de verdade de preço.
   * Isso impede que alguém manipule o valor cobrado editando o payload do
   * checkout no navegador.
   */
  async createPendingOneOffPayment(params: {
    tenantId: string;
    productCode: OneOffProductCode;
    method: PaymentMethod;
  }): Promise<Payment> {
    const product = ONE_OFF_PRODUCTS[params.productCode];
    const payment = this.payments.create({
      tenant_id: params.tenantId,
      plan_requested: 'CREATOR', // sem efeito para product_type != 'PLAN'; ver confirmPayment()
      product_type: params.productCode,
      credits_granted: product.credits,
      amount_cents: product.amountCents,
      method: params.method,
      status: 'pending',
    });
    return this.payments.save(payment);
  }

  /** Anexa o ID do pagamento no gateway assim que ele responde à criação da cobrança (PIX/preferência). */
  async attachExternalId(paymentId: string, externalId: string): Promise<void> {
    await this.payments.update({ id: paymentId }, { external_id: externalId });
  }

  async getPayment(paymentId: string): Promise<Payment> {
    const payment = await this.payments.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException(`Pagamento ${paymentId} não encontrado.`);
    return payment;
  }

  /**
   * Confirma um pagamento (chamado pelo webhook, depois de já ter
   * verificado a assinatura do Mercado Pago e revalidado o status direto
   * na API deles — nunca confiar só no corpo do webhook).
   *
   * IDEMPOTENTE: se o pagamento já não está mais 'pending' (um webhook
   * duplicado, reenvio da Meta/Mercado Pago), não faz nada de novo — nunca
   * promove o tenant duas vezes nem sobrescreve um status já definitivo.
   */
  async confirmPayment(paymentId: string, externalId: string, newStatus: PaymentStatus): Promise<{ upgraded: boolean }> {
    const payment = await this.getPayment(paymentId);

    if (payment.status !== 'pending') {
      this.logger.log(`Pagamento ${paymentId} já processado (status=${payment.status}) — webhook ignorado (idempotência).`);
      return { upgraded: false };
    }

    await this.payments.update({ id: paymentId }, { status: newStatus, external_id: externalId });

    if (newStatus === 'approved') {
      if (payment.product_type === 'PLAN') {
        await this.usage.upgradePlan(payment.tenant_id, payment.plan_requested);
        this.logger.log(`Tenant ${payment.tenant_id} promovido para ${payment.plan_requested} (pagamento ${paymentId}).`);
      } else {
        // Compra avulsa (AVULSO/PACOTE5): soma créditos, NÃO mexe em plan_tier.
        await this.usage.addCredits(payment.tenant_id, payment.credits_granted);
        this.logger.log(
          `Tenant ${payment.tenant_id} recebeu ${payment.credits_granted} crédito(s) de vídeo (produto ${payment.product_type}, pagamento ${paymentId}).`,
        );
      }
      return { upgraded: true };
    }

    return { upgraded: false };
  }
}
