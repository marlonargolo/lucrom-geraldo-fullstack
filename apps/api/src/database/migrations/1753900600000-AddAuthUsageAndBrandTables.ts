import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona as tabelas de Auth, Usage e Brand:
 *
 *  - `tenants.monthly_ai_generations` / `usage_period_start`: usados por
 *    `UsageService.consume`/`.peek` (controle de cotas de negócio).
 *  - `users`: cadastro/login real (JWT), complementar ao ApiTokenGuard
 *    (token estático por ambiente, usado em fluxos server-to-server).
 *  - `niche_presets` / `brand_kits`: Brand Kit + Nicho como dado no banco.
 *    `niche_presets` é semeada aqui com as mesmas 4 chaves já hardcoded em
 *    `engines/m8/niche-preset.service.ts` (NicheType), pra manter os dois
 *    lados em sincronia.
 */
export class AddAuthUsageAndBrandTables1753900600000 implements MigrationInterface {
  name = 'AddAuthUsageAndBrandTables1753900600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- Cotas em tenants (UsageService) ----
    await queryRunner.query(`
      ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS monthly_ai_generations INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS usage_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);

    // ---- users (AuthModule) ----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
        last_login_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);`);

    // ---- niche_presets (BrandModule) ----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS niche_presets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(50) NOT NULL,
        label VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_niche_presets_key ON niche_presets(key);`);

    // Seed: mesmas 4 chaves de engines/m8/niche-preset.service.ts (NicheType).
    await queryRunner.query(`
      INSERT INTO niche_presets (key, label, description) VALUES
        ('marcenaria', 'Marcenaria', 'Oficina moderna, iluminação quente, acabamentos em madeira'),
        ('farmacia', 'Farmácia', 'Ambiente clean, tons claros, prateleiras organizadas'),
        ('mercado', 'Mercado / Padaria', 'Gastronômico e artesanal, balcão iluminado'),
        ('escritorio', 'Escritório', 'Sala de reunião moderna, LED, fundo desfocado')
      ON CONFLICT (key) DO NOTHING;
    `);

    // ---- brand_kits (BrandModule) ----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS brand_kits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        palette JSONB NOT NULL,
        font_family VARCHAR(100),
        logo_url VARCHAR(500),
        niche_preset_id UUID REFERENCES niche_presets(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_brand_kits_tenant_id ON brand_kits(tenant_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS brand_kits;`);
    await queryRunner.query(`DROP TABLE IF EXISTS niche_presets;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);
    await queryRunner.query(`
      ALTER TABLE tenants
      DROP COLUMN IF EXISTS monthly_ai_generations,
      DROP COLUMN IF EXISTS usage_period_start;
    `);
  }
}
