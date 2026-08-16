import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BLINDAGEM FINANCEIRA — fecha a brecha em que `AiOrchestratorService.submit()`
 * (chamado tanto pelo Director Engine — sessions/:id/production — quanto pelo
 * endpoint legado `POST /api/v1/engines/m8/ai-video/generate`, usado por
 * `briefing-composer.tsx`) disparava Kling/MiniMax (custo real por chamada)
 * SEM checar a cota do tenant (`UsageService.consume`).
 *
 * `quota_charged` / `quota_charged_extra_credit`: registram, no próprio job,
 * SE e COMO 1 unidade de cota foi debitada no momento da submissão (cota
 * mensal do plano vs. crédito avulso AVULSO/PACOTE5) — necessário porque o
 * estorno (ver `quota_refunded` abaixo) precisa saber pra qual dos dois
 * saldos devolver.
 *
 * `quota_refunded`: idempotência do estorno automático quando o provedor
 * (Kling/MiniMax) falha depois de já termos debitado a cota — sem esta
 * flag, um reenvio de webhook do provedor (comum, eles reenviam até
 * receberem 2xx) devolveria o crédito mais de uma vez.
 */
export class AddQuotaChargeTrackingToAiGenerationJobs1754400000000 implements MigrationInterface {
  name = 'AddQuotaChargeTrackingToAiGenerationJobs1754400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_generation_jobs
        ADD COLUMN IF NOT EXISTS quota_charged BOOLEAN NOT NULL DEFAULT false;
    `);
    await queryRunner.query(`
      ALTER TABLE ai_generation_jobs
        ADD COLUMN IF NOT EXISTS quota_charged_extra_credit BOOLEAN NOT NULL DEFAULT false;
    `);
    await queryRunner.query(`
      ALTER TABLE ai_generation_jobs
        ADD COLUMN IF NOT EXISTS quota_refunded BOOLEAN NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ai_generation_jobs DROP COLUMN IF EXISTS quota_refunded;`);
    await queryRunner.query(`ALTER TABLE ai_generation_jobs DROP COLUMN IF EXISTS quota_charged_extra_credit;`);
    await queryRunner.query(`ALTER TABLE ai_generation_jobs DROP COLUMN IF EXISTS quota_charged;`);
  }
}
