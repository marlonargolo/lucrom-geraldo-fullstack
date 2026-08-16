import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona as tabelas necessárias pelas Lacunas 1-3 (backend):
 *   • scripts               — ScriptGeneratorService (contrato JSON de roteiro/copy)
 *   • graphic_compositions  — GraphicComposerService (carrosséis/artes estáticas)
 *   • voice_commands        — VoiceCommandService (transcrição + intent de comandos de voz)
 *
 * A Lacuna 4 (Motion Graphics) e a extensão de `media_assets.engine_source`
 * (novos valores GRAPHIC_COMPOSER/VOICE_COMMAND/MOTION_GRAPHICS) não exigem
 * migration — `engine_source` já é VARCHAR livre e `metadata`/demais colunas
 * de saída já são JSONB, aceitando qualquer estrutura nova sem DDL.
 */
export class AddCreativeSuiteTables1753900300000 implements MigrationInterface {
  name = 'AddCreativeSuiteTables1753900300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- scripts (Lacuna 1 — ScriptGeneratorService) ----
    await queryRunner.query(`
      CREATE TABLE scripts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        niche VARCHAR(50) NOT NULL,
        platform VARCHAR(50) NOT NULL,
        brief TEXT NOT NULL,
        contract JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'DONE',
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_scripts_tenant_id ON scripts(tenant_id);`);

    // ---- graphic_compositions (Lacuna 2 — GraphicComposerService) ----
    await queryRunner.query(`
      CREATE TABLE graphic_compositions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        kind VARCHAR(20) NOT NULL,
        format VARCHAR(20) NOT NULL,
        output_asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        brand_kit_snapshot JSONB,
        status VARCHAR(20) NOT NULL DEFAULT 'DONE',
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_graphic_compositions_tenant_id ON graphic_compositions(tenant_id);`);

    // ---- voice_commands (Lacuna 3 — VoiceCommandService) ----
    await queryRunner.query(`
      CREATE TABLE voice_commands (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        transcript TEXT NOT NULL,
        intent JSONB NOT NULL,
        audio_asset_id UUID REFERENCES media_assets(id),
        status VARCHAR(20) NOT NULL DEFAULT 'DONE',
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_voice_commands_tenant_id ON voice_commands(tenant_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS voice_commands;`);
    await queryRunner.query(`DROP TABLE IF EXISTS graphic_compositions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS scripts;`);
  }
}
