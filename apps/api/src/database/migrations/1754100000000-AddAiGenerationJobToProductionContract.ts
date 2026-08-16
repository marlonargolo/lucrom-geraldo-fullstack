import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Conecta o Director Engine ao pipeline real de geração de vídeo: adiciona
 * `production_contracts.ai_generation_job_id`, apontando pra linha em
 * `ai_generation_jobs` (Kling/MiniMax) criada no momento em que o contrato
 * de produção é montado — ver DirectorService.advanceProduction.
 */
export class AddAiGenerationJobToProductionContract1754100000000 implements MigrationInterface {
  name = 'AddAiGenerationJobToProductionContract1754100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE production_contracts
      ADD COLUMN IF NOT EXISTS ai_generation_job_id UUID REFERENCES ai_generation_jobs(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE production_contracts
      ALTER COLUMN status SET DEFAULT 'READY';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE production_contracts DROP COLUMN IF EXISTS ai_generation_job_id;`);
  }
}
