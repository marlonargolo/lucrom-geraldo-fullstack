import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pipeline V2 — adiciona suporte às Etapas 1-4 na tabela render_jobs:
 *   • pipeline_options agora inclui: enable_audio_clean, enable_matting,
 *     niche, language, output_width, output_height.
 *   • metadata dos media_assets de saída inclui: niche, matting_enabled,
 *     audio_clean_enabled, word_timestamps_count.
 *
 * NOTA: pipeline_options e metadata já são JSONB — nenhuma alteração de
 * schema de coluna é necessária, pois JSONB aceita qualquer estrutura.
 * Esta migration serve como documentação formal da extensão de contrato
 * e cria os índices de consulta para as novas colunas lógicas.
 */
export class AddPipelineV2Fields1753900200000 implements MigrationInterface {
  name = 'AddPipelineV2Fields1753900200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Índice para queries por nicho nos render_jobs (analytics por segmento)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_render_jobs_niche
        ON render_jobs ((pipeline_options->>'niche'))
        WHERE pipeline_options->>'niche' IS NOT NULL;
    `);

    // Índice para queries por status de matting (auditoria de uso do RVM)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_render_jobs_matting
        ON render_jobs (((pipeline_options->>'enable_matting')::boolean))
        WHERE (pipeline_options->>'enable_matting')::boolean = true;
    `);

    // Índice para assets de saída do M8 por niche (relatórios por segmento)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_media_assets_niche
        ON media_assets ((metadata->>'niche'))
        WHERE metadata->>'niche' IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_media_assets_niche;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_render_jobs_matting;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_render_jobs_niche;`);
  }
}
