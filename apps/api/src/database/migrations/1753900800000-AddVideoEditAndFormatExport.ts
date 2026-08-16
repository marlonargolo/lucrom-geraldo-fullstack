import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Edição pós-geração (`video_edits`) + Export automático multi-formato
 * (`format_exports`) — conectam a camada de produto ao que já existia
 * (FfmpegService.trim/cropToAspectRatio/renderLowerThird, GraphicComposerService).
 */
export class AddVideoEditAndFormatExport1753900800000 implements MigrationInterface {
  name = 'AddVideoEditAndFormatExport1753900800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS video_edits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        source_asset_id UUID NOT NULL,
        output_asset_id UUID,
        start_time_seconds REAL NOT NULL,
        end_time_seconds REAL NOT NULL,
        caption JSONB,
        status VARCHAR(20) NOT NULL DEFAULT 'DONE',
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_video_edits_tenant_id ON video_edits(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_video_edits_source_asset_id ON video_edits(source_asset_id);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS format_exports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        source_asset_id UUID NOT NULL,
        script_id UUID,
        requested_formats JSONB NOT NULL,
        results JSONB NOT NULL,
        status VARCHAR(20) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_format_exports_tenant_id ON format_exports(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_format_exports_source_asset_id ON format_exports(source_asset_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS format_exports;`);
    await queryRunner.query(`DROP TABLE IF EXISTS video_edits;`);
  }
}
