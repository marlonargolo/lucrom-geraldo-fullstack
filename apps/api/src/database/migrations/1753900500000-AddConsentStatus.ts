import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona `consent_records.status`: o aceite do usuário é persistido
 * explicitamente como 'LEGAL_CONSENT_GRANTED'. Registros existentes são
 * migrados com base no campo `revoked_at`, que já era a fonte de verdade
 * operacional.
 */
export class AddConsentStatus1753900500000 implements MigrationInterface {
  name = 'AddConsentStatus1753900500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE consent_records
      ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'LEGAL_CONSENT_GRANTED';
    `);
    await queryRunner.query(`
      UPDATE consent_records SET status = 'LEGAL_CONSENT_REVOKED' WHERE revoked_at IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE consent_records DROP COLUMN IF EXISTS status;`);
  }
}
