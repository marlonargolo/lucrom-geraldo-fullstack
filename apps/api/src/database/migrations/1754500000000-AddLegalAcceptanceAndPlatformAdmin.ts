import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aceite legal no cadastro + administrador de PLATAFORMA.
 *
 * `users.terms_version` / `users.privacy_version` / `users.legal_accepted_at`:
 * versão dos Termos de Uso e da Política de Privacidade aceitas no
 * auto-cadastro (ver apps/web/lib/legal/policies.ts — LEGAL_POLICY_VERSIONS)
 * e quando. Nullable: usuários criados antes desta migração não têm aceite
 * registrado.
 *
 * `users.is_platform_admin`: acesso ao painel /studio/admin (equipe da
 * plataforma). Distinto de `role` (escopo de TENANT — todo cliente nasce
 * ADMIN da própria conta). Nunca é definido pela API pública: promover um
 * usuário é feito direto no banco, ex.:
 *   UPDATE users SET is_platform_admin = true WHERE email = 'voce@empresa.com';
 */
export class AddLegalAcceptanceAndPlatformAdmin1754500000000 implements MigrationInterface {
  name = 'AddLegalAcceptanceAndPlatformAdmin1754500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS terms_version VARCHAR(80),
        ADD COLUMN IF NOT EXISTS privacy_version VARCHAR(80),
        ADD COLUMN IF NOT EXISTS legal_accepted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_users_is_platform_admin ON users(is_platform_admin) WHERE is_platform_admin = true;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_is_platform_admin;`);
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS is_platform_admin,
        DROP COLUMN IF EXISTS legal_accepted_at,
        DROP COLUMN IF EXISTS privacy_version,
        DROP COLUMN IF EXISTS terms_version;
    `);
  }
}
