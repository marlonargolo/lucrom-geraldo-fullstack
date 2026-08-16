import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Billing & Checkout: registra tentativas de upgrade de plano (PIX/Cartão
 * via Mercado Pago) e seu status, permitindo ao webhook confirmar
 * pagamentos de forma idempotente e correlacionar de volta ao tenant certo
 * via `id` (usado como external_reference no gateway).
 */
export class AddPayments1753900700000 implements MigrationInterface {
  name = 'AddPayments1753900700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        provider VARCHAR(30) NOT NULL DEFAULT 'mercadopago',
        method VARCHAR(20),
        external_id VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        plan_requested VARCHAR(30) NOT NULL,
        amount_cents INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_payments_external_id ON payments(external_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS payments;`);
  }
}
