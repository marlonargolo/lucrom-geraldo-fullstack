import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Avatar Engine — avatar real do tenant + voz clonada + lip-sync, usando
 * 100% os provedores já integrados no projeto (Kling + MiniMax, sem
 * fornecedor novo). Ver `apps/api/src/engines/avatar/*`.
 */
export class AddAvatarEngine1754000000000 implements MigrationInterface {
  name = 'AddAvatarEngine1754000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS voice_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        source_asset_id UUID,
        external_voice_id VARCHAR(100),
        last_used_at TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_voice_profiles_tenant_id ON voice_profiles(tenant_id);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS avatar_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        source_asset_id UUID NOT NULL,
        consent_record_id UUID NOT NULL REFERENCES consent_records(id),
        kling_session_id VARCHAR(100),
        kling_face_id VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_avatar_profiles_tenant_id ON avatar_profiles(tenant_id);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS avatar_generation_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        avatar_profile_id UUID NOT NULL REFERENCES avatar_profiles(id) ON DELETE CASCADE,
        voice_profile_id UUID NOT NULL REFERENCES voice_profiles(id) ON DELETE CASCADE,
        script_text TEXT NOT NULL,
        narration_s3_key VARCHAR(500),
        aspect_ratio VARCHAR(10) NOT NULL,
        external_task_id VARCHAR(255),
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        raw_result_url TEXT,
        final_asset_id UUID,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_avatar_generation_jobs_tenant_id ON avatar_generation_jobs(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_avatar_generation_jobs_external_task_id ON avatar_generation_jobs(external_task_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS avatar_generation_jobs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS avatar_profiles;`);
    await queryRunner.query(`DROP TABLE IF EXISTS voice_profiles;`);
  }
}
