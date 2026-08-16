import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration inicial do LUCROM Studio AI.
 *
 * As 3 primeiras tabelas (tenants, media_assets, audit_gate_logs) reproduzem
 * EXATAMENTE o SQL do Documento Mestre 02 §2 / Blueprint Executivo Vol.3 §1
 * — incluindo tipos, defaults e nomes de coluna, sem nenhuma alteração.
 *
 * consent_records e render_jobs são extensões necessárias, não previstas no
 * schema original, documentadas em cada entidade correspondente.
 */
export class InitSchema1753900000000 implements MigrationInterface {
  name = 'InitSchema1753900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    // ---- tenants (Documento Mestre 02 §2.1 / Blueprint Vol.3 §1.1) ----
    await queryRunner.query(`
      CREATE TABLE tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        plan_tier VARCHAR(50) DEFAULT 'CREATOR',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ---- media_assets (Documento Mestre 02 §2.2 / Blueprint Vol.3 §1.2) ----
    await queryRunner.query(`
      CREATE TABLE media_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        engine_source VARCHAR(20) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        s3_bucket VARCHAR(100) NOT NULL,
        s3_key VARCHAR(500) NOT NULL,
        file_size_bytes BIGINT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_media_assets_tenant_id ON media_assets(tenant_id);`);

    // ---- audit_gate_logs (Documento Mestre 02 §2.3 / Blueprint Vol.3 §1.3) ----
    await queryRunner.query(`
      CREATE TABLE audit_gate_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id),
        asset_id UUID REFERENCES media_assets(id),
        gate_stage VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        qa_score NUMERIC(4,2),
        rejection_reason TEXT,
        checks JSONB,
        audited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_audit_gate_logs_tenant_id ON audit_gate_logs(tenant_id);`);

    // ---- consent_records (extensão — Seção 12 do Documento Mestre Consolidado) ----
    await queryRunner.query(`
      CREATE TABLE consent_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        subject_type VARCHAR(10) NOT NULL CHECK (subject_type IN ('face','voice')),
        subject_name VARCHAR(255) NOT NULL,
        contract_s3_key VARCHAR(500),
        granted_at TIMESTAMP WITH TIME ZONE NOT NULL,
        revoked_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_consent_records_tenant_id ON consent_records(tenant_id);`);

    // ---- render_jobs (extensão — rastreio do job assíncrono do M8) ----
    await queryRunner.query(`
      CREATE TABLE render_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id),
        script_id UUID NOT NULL,
        raw_asset_id UUID REFERENCES media_assets(id) NOT NULL,
        output_asset_id UUID REFERENCES media_assets(id),
        pipeline_options JSONB NOT NULL,
        brand_kit_snapshot JSONB,
        status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
        queue_job_id VARCHAR(100),
        queue_name VARCHAR(50) NOT NULL,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_render_jobs_tenant_id ON render_jobs(tenant_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS render_jobs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS consent_records;`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_gate_logs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS media_assets;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenants;`);
  }
}
