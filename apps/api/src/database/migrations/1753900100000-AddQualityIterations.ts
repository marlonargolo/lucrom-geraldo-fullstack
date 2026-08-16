import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQualityIterations1753900100000 implements MigrationInterface {
  name = 'AddQualityIterations1753900100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE quality_iterations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        render_job_id UUID REFERENCES render_jobs(id) ON DELETE CASCADE NOT NULL,
        iteration_number INT NOT NULL,
        overall_score NUMERIC(5,2) NOT NULL,
        passed BOOLEAN NOT NULL,
        axes JSONB NOT NULL,
        correction_applied JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_quality_iterations_render_job_id ON quality_iterations(render_job_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS quality_iterations;`);
  }
}
