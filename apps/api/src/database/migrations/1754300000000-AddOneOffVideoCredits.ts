import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Compra avulsa (1 vídeo, R$ 9,90) e Pacote 5 vídeos 60s (R$ 179,90) —
 * produtos de compra única, fora do ciclo de assinatura mensal.
 *
 * `tenants.extra_video_credits`: saldo de vídeos comprados avulsos, que o
 * UsageService consome SOMENTE depois que a cota mensal do plano já foi
 * usada (ver UsageService.consume) — não expira na virada do mês, ao
 * contrário de `monthly_ai_generations`.
 *
 * `payments.product_type` + `payments.credits_granted`: distingue um
 * pagamento de UPGRADE DE PLANO (product_type = 'PLAN', usa
 * `plan_requested`) de um pagamento de COMPRA AVULSA (product_type =
 * 'AVULSO' | 'PACOTE5', usa `credits_granted`). `plan_requested` continua
 * NOT NULL por compatibilidade com o fluxo antigo — pagamentos avulsos
 * gravam 'CREATOR' ali (nenhum efeito, pois BillingService.confirmPayment
 * só chama `usage.upgradePlan` quando product_type = 'PLAN').
 */
export class AddOneOffVideoCredits1754300000000 implements MigrationInterface {
  name = 'AddOneOffVideoCredits1754300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS extra_video_credits INT NOT NULL DEFAULT 0;
    `);

    await queryRunner.query(`
      ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) NOT NULL DEFAULT 'PLAN';
    `);
    await queryRunner.query(`
      ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS credits_granted INT NOT NULL DEFAULT 0;
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_payments_product_type ON payments(product_type);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payments_product_type;`);
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS credits_granted;`);
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS product_type;`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS extra_video_credits;`);
  }
}
