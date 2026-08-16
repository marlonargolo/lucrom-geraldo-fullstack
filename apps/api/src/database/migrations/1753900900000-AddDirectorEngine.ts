import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Director Engine — sessão de produção orquestrada (CREATED → BUSINESS →
 * STRATEGY → CREATIVE → PRODUCTION). Peça ausente de todos os pacotes
 * recebidos até agora (ver CHANGELOG-UNIFICACAO.md, "Fora do escopo desta
 * entrega") — construída com base no contrato já consumido pelo frontend
 * (`apps/web/lib/production/real-production-client.ts`).
 */
export class AddDirectorEngine1753900900000 implements MigrationInterface {
  name = 'AddDirectorEngine1753900900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS project_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        brand_id UUID NOT NULL REFERENCES brand_kits(id) ON DELETE CASCADE,
        current_stage VARCHAR(20) NOT NULL DEFAULT 'CREATED',
        business_ticket_id UUID,
        strategy_brief_id UUID,
        creative_manifest_id UUID,
        render_job_id UUID,
        quality_audit_id UUID,
        abort_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_project_sessions_tenant_id ON project_sessions(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_project_sessions_brand_id ON project_sessions(brand_id);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS business_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES project_sessions(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        brand_id UUID NOT NULL,
        problem_category VARCHAR(30) NOT NULL,
        problem_description TEXT NOT NULL,
        target_metric VARCHAR(200) NOT NULL,
        current_value VARCHAR(200),
        target_value VARCHAR(200),
        viability_score INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_business_tickets_session_id ON business_tickets(session_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_business_tickets_tenant_id ON business_tickets(tenant_id);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS strategy_briefs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES project_sessions(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        business_ticket_id UUID NOT NULL REFERENCES business_tickets(id) ON DELETE CASCADE,
        target_audience JSONB NOT NULL,
        core_thesis TEXT NOT NULL,
        angle VARCHAR(30) NOT NULL,
        psychological_approach VARCHAR(30) NOT NULL,
        primary_channel VARCHAR(30) NOT NULL,
        desired_emotion VARCHAR(20) NOT NULL,
        call_to_action_type VARCHAR(30) NOT NULL,
        tone_of_voice VARCHAR(200),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_strategy_briefs_session_id ON strategy_briefs(session_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_strategy_briefs_tenant_id ON strategy_briefs(tenant_id);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS creative_manifests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES project_sessions(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        strategy_brief_id UUID NOT NULL REFERENCES strategy_briefs(id) ON DELETE CASCADE,
        script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
        voice_id VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_creative_manifests_session_id ON creative_manifests(session_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_creative_manifests_tenant_id ON creative_manifests(tenant_id);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS production_contracts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES project_sessions(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        brand_id UUID NOT NULL,
        creative_manifest_id UUID NOT NULL REFERENCES creative_manifests(id) ON DELETE CASCADE,
        script_id UUID NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'READY',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_production_contracts_session_id ON production_contracts(session_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_production_contracts_tenant_id ON production_contracts(tenant_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS production_contracts;`);
    await queryRunner.query(`DROP TABLE IF EXISTS creative_manifests;`);
    await queryRunner.query(`DROP TABLE IF EXISTS strategy_briefs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS business_tickets;`);
    await queryRunner.query(`DROP TABLE IF EXISTS project_sessions;`);
  }
}
