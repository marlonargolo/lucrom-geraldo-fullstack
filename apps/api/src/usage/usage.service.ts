import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanTier, Tenant } from '../tenants/tenant.entity';

/**
 * Limite mensal de gerações de IA por plano — CREATOR é o plano de entrada
 * (auto-cadastro, ver AuthService.register), PRO é o plano pago
 * intermediário (Billing/Mercado Pago), ENTERPRISE é essencialmente
 * ilimitado neste MVP (número alto em vez de lógica de branch "sem limite"
 * separada, menos caminho de código pra validar).
 */
export const PLAN_QUOTA_LIMITS: Record<PlanTier, number> = {
  CREATOR: 1,
  PRO: 100,
  ENTERPRISE: 100_000,
};

export type QuotaType = 'ai_generation';

export interface QuotaConsumeResult {
  allowed: boolean;
  used: number;
  limit: number;
  plan: PlanTier;
  periodStart: Date;
  /** true quando esta geração consumiu 1 crédito avulso (AVULSO/PACOTE5) em vez da cota mensal do plano. */
  usedExtraCredit?: boolean;
  /** Saldo de créditos avulsos restante após esta chamada — só relevante quando `usedExtraCredit` ou `allowed: false`. */
  extraCreditsRemaining?: number;
}

@Injectable()
export class UsageService {
  constructor(@InjectRepository(Tenant) private readonly tenants: Repository<Tenant>) {}

  /**
   * Tenta consumir 1 unidade de cota do tenant, de forma ATÔMICA: uma única
   * UPDATE condicional no Postgres decide, no mesmo round-trip, se (a) o
   * período mensal virou (reseta o contador pra 1) ou (b) o tenant ainda
   * está sob o limite do seu plano (incrementa). Sem isso, duas requisições
   * concorrentes do mesmo tenant poderiam ler o mesmo contador antes de
   * qualquer uma escrever de volta ("check-then-act" clássico) e as duas
   * passariam mesmo já no limite — o UPDATE resolve isso no banco, não na
   * aplicação.
   *
   * Se a cota mensal do plano já estourou, cai para o saldo de créditos
   * avulsos (`extra_video_credits` — comprados via produto AVULSO ou
   * PACOTE5, ver billing/one-off-products.ts) ANTES de bloquear: uma
   * segunda UPDATE condicional, também atômica, decrementa 1 crédito se
   * houver saldo (`extra_video_credits > 0`). Só quando as DUAS UPDATEs
   * falham em afetar linha é que a requisição é de fato bloqueada.
   *
   * Se a UPDATE não afeta nenhuma linha, é porque o tenant já está no
   * limite do mês corrente E sem créditos avulsos (`allowed: false`) — uma
   * leitura extra só nesse caminho (não no caminho feliz) monta a mensagem
   * de erro.
   */
  async consume(tenantId: string, _quotaType: QuotaType = 'ai_generation'): Promise<QuotaConsumeResult> {
    const creatorLimit = PLAN_QUOTA_LIMITS.CREATOR;
    const proLimit = PLAN_QUOTA_LIMITS.PRO;
    const enterpriseLimit = PLAN_QUOTA_LIMITS.ENTERPRISE;

    // IMPORTANTE: Repository.query() com UPDATE...RETURNING neste driver
    // retorna uma TUPLA `[rows, affectedCount]`, não o array de linhas
    // direto — descobri isso rodando um smoke-test E2E de verdade contra
    // Postgres real; sem isso, `rows.length > 0` era sempre verdadeiro
    // (a tupla sempre tem 2 elementos) e `rows[0]` era o array de linhas
    // inteiro em vez do primeiro registro, então TODO campo lido vinha
    // `undefined` e a cota nunca bloqueava ninguém. `tsc` nunca acusou isso
    // porque é query raw — a anotação de tipo não é verificada em runtime.
    const [rows]: [Array<{ monthly_ai_generations: number; plan_tier: PlanTier; usage_period_start: Date }>, number] =
      await this.tenants.query(
        `
        UPDATE tenants
        SET monthly_ai_generations = CASE
              WHEN date_trunc('month', usage_period_start) <> date_trunc('month', now())
                THEN 1
              ELSE monthly_ai_generations + 1
            END,
            usage_period_start = CASE
              WHEN date_trunc('month', usage_period_start) <> date_trunc('month', now())
                THEN now()
              ELSE usage_period_start
            END
        WHERE id = $1
          AND (
            date_trunc('month', usage_period_start) <> date_trunc('month', now())
            OR monthly_ai_generations < (
                 CASE plan_tier
                   WHEN 'ENTERPRISE' THEN $4::int
                   WHEN 'PRO' THEN $3::int
                   ELSE $2::int
                 END
               )
          )
        RETURNING monthly_ai_generations, plan_tier, usage_period_start;
        `,
        [tenantId, creatorLimit, proLimit, enterpriseLimit],
      );

    if (rows.length > 0) {
      const row = rows[0];
      return {
        allowed: true,
        used: Number(row.monthly_ai_generations),
        limit: PLAN_QUOTA_LIMITS[row.plan_tier] ?? creatorLimit,
        plan: row.plan_tier,
        periodStart: row.usage_period_start,
        usedExtraCredit: false,
      };
    }

    // Cota mensal do plano esgotada — tenta cair pro saldo de crédito
    // avulso antes de bloquear. Também é uma UPDATE condicional atômica
    // (mesmo raciocínio de concorrência do bloco acima): só decrementa se
    // `extra_video_credits > 0` no mesmo round-trip que lê o valor.
    const [creditRows]: [Array<{ extra_video_credits: number; plan_tier: PlanTier; usage_period_start: Date }>, number] =
      await this.tenants.query(
        `
        UPDATE tenants
        SET extra_video_credits = extra_video_credits - 1
        WHERE id = $1 AND extra_video_credits > 0
        RETURNING extra_video_credits, plan_tier, usage_period_start;
        `,
        [tenantId],
      );

    if (creditRows.length > 0) {
      const row = creditRows[0];
      return {
        allowed: true,
        used: PLAN_QUOTA_LIMITS[row.plan_tier] ?? creatorLimit,
        limit: PLAN_QUOTA_LIMITS[row.plan_tier] ?? creatorLimit,
        plan: row.plan_tier,
        periodStart: row.usage_period_start,
        usedExtraCredit: true,
        extraCreditsRemaining: Number(row.extra_video_credits),
      };
    }

    // As DUAS UPDATEs (cota mensal e crédito avulso) não afetaram nenhuma
    // linha: ou o tenant não existe, ou (o caso esperado) já está sem
    // saldo dos dois. Uma leitura simples distingue os dois e monta a
    // resposta 402 com números corretos.
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} não encontrado.`);

    return {
      allowed: false,
      used: tenant.monthly_ai_generations,
      limit: PLAN_QUOTA_LIMITS[tenant.plan_tier] ?? creatorLimit,
      plan: tenant.plan_tier,
      periodStart: tenant.usage_period_start,
      usedExtraCredit: false,
      extraCreditsRemaining: tenant.extra_video_credits,
    };
  }

  /** Consulta o uso atual SEM consumir cota — útil pra UI mostrar "3/5 usados este mês" antes de gerar. */
  async peek(tenantId: string): Promise<QuotaConsumeResult> {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} não encontrado.`);

    const sameMonth =
      new Date(tenant.usage_period_start).getUTCFullYear() === new Date().getUTCFullYear() &&
      new Date(tenant.usage_period_start).getUTCMonth() === new Date().getUTCMonth();
    const used = sameMonth ? tenant.monthly_ai_generations : 0;

    return {
      allowed: used < (PLAN_QUOTA_LIMITS[tenant.plan_tier] ?? PLAN_QUOTA_LIMITS.CREATOR) || tenant.extra_video_credits > 0,
      used,
      limit: PLAN_QUOTA_LIMITS[tenant.plan_tier] ?? PLAN_QUOTA_LIMITS.CREATOR,
      plan: tenant.plan_tier,
      periodStart: tenant.usage_period_start,
      extraCreditsRemaining: tenant.extra_video_credits,
    };
  }

  /**
   * Soma `credits` ao saldo avulso do tenant (`extra_video_credits`).
   * Chamado por BillingService.confirmPayment() após aprovação de um
   * pagamento com product_type 'AVULSO' (1 crédito) ou 'PACOTE5' (5
   * créditos) — ver billing/one-off-products.ts para os valores.
   * ATÔMICO (increment direto no banco, não lê-modifica-escreve), então
   * duas aprovações concorrentes do mesmo tenant nunca se pisam.
   */
  async addCredits(tenantId: string, credits: number): Promise<void> {
    await this.tenants.increment({ id: tenantId }, 'extra_video_credits', credits);
  }

  /**
   * Estorna 1 unidade de cota — chamado por
   * `AiOrchestratorService.markFailed()` quando o job já tinha debitado
   * cota (`quota_charged`) mas o provedor (Kling/MiniMax) falhou depois de
   * consumir o crédito: o tenant não deve pagar (em cota ou em crédito
   * avulso) por um vídeo que nunca foi entregue.
   *
   * `wasExtraCredit=true` devolve pro saldo avulso (`extra_video_credits`,
   * increment atômico simples — nunca expira, então sempre é seguro
   * devolver). `wasExtraCredit=false` decrementa `monthly_ai_generations`
   * SOMENTE se o período mensal ainda for o mesmo em que o débito
   * ocorreu — se o mês já virou entre o débito e a falha, o contador já foi
   * resetado a zero pra esse tenant (nova cota do mês) e "devolver" não
   * faria sentido (poderia até deixar o valor negativo). `GREATEST(0, ...)`
   * é uma segunda rede de segurança pro mesmo caso.
   */
  async refund(tenantId: string, wasExtraCredit: boolean): Promise<void> {
    if (wasExtraCredit) {
      await this.tenants.increment({ id: tenantId }, 'extra_video_credits', 1);
      return;
    }
    await this.tenants.query(
      `
      UPDATE tenants
      SET monthly_ai_generations = GREATEST(0, monthly_ai_generations - 1)
      WHERE id = $1
        AND date_trunc('month', usage_period_start) = date_trunc('month', now());
      `,
      [tenantId],
    );
  }

  /**
   * Promove o tenant pra um novo plano e ZERA o contador mensal (dá o mês
   * cheio de novo, em vez do usuário pagar o upgrade e continuar vendo
   * "5/5 usados" com o limite antigo até a próxima virada de mês). Chamado
   * por BillingService após confirmação de pagamento — ver
   * billing.service.ts::confirmPayment().
   */
  async upgradePlan(tenantId: string, newPlan: PlanTier): Promise<void> {
    await this.tenants.update({ id: tenantId }, { plan_tier: newPlan, monthly_ai_generations: 0, usage_period_start: new Date() });
  }
}
