import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona as tabelas de trilha de auditoria e geração de IA assíncrona:
 *   • audit_logs          — AuthAuditMiddleware (trilha de escrita, governança)
 *   • ai_generation_jobs   — AiOrchestratorService (Geração de Vídeo Assíncrona)
 */
export class AddAuditAndAiGenerationTables1753900400000 implements MigrationInterface {
  name = 'AddAuditAndAiGenerationTables1753900400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID,
        actor VARCHAR(255) NOT NULL DEFAULT 'api_token',
        method VARCHAR(10) NOT NULL,
        route VARCHAR(500) NOT NULL,
        status_code INT NOT NULL,
        ip_address VARCHAR(64),
        request_body JSONB,
        duration_ms INT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);`);

    await queryRunner.query(`
      CREATE TABLE ai_generation_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        provider VARCHAR(20) NOT NULL,
        external_job_id VARCHAR(255),
        prompt TEXT NOT NULL,
        aspect_ratio VARCHAR(10) NOT NULL,
        brand_kit JSONB,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        raw_result_url TEXT,
        final_asset_id UUID REFERENCES media_assets(id),
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_ai_generation_jobs_tenant_id ON ai_generation_jobs(tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_ai_generation_jobs_external_job_id ON ai_generation_jobs(external_job_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_generation_jobs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs;`);
  }
}
