import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Módulo Arquitetural — Ajuste Rápido Humano.
 *
 * Adiciona o modelo de camadas editáveis à tabela `graphic_compositions`,
 * permitindo edição pós-geração 100% determinística (fonte, tamanho, cor,
 * posição, opacidade, troca de ativo, visibilidade) sem nova chamada de IA
 * — ver GraphicComposerService.updateLayers().
 *
 *   • `layers`  — snapshot estruturado por slide (GraphicSlideLayers[]),
 *                 nullable: peças criadas antes desta migration não têm
 *                 camadas e não podem ser editadas por este módulo (ver
 *                 checagem em updateLayers, que orienta gerar peça nova).
 *   • `version` — nasce em 1 (a própria geração inicial); cada ajuste
 *                 determinístico (ou restauração de versão) incrementa.
 *   • `history` — array de snapshots anteriores (mais recente primeiro),
 *                 default '[]' pra nunca precisar de coalesce no código.
 *   • `updated_at` — a entidade já tinha só `created_at`; ajustes agora
 *                 alteram a linha, então a coluna passa a existir.
 */
export class AddQuickAdjustLayers1754200000000 implements MigrationInterface {
  name = 'AddQuickAdjustLayers1754200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE graphic_compositions
      ADD COLUMN IF NOT EXISTS layers JSONB NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE graphic_compositions
      ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
    `);
    await queryRunner.query(`
      ALTER TABLE graphic_compositions
      ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]';
    `);
    await queryRunner.query(`
      ALTER TABLE graphic_compositions
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE graphic_compositions DROP COLUMN IF EXISTS updated_at;`);
    await queryRunner.query(`ALTER TABLE graphic_compositions DROP COLUMN IF EXISTS history;`);
    await queryRunner.query(`ALTER TABLE graphic_compositions DROP COLUMN IF EXISTS version;`);
    await queryRunner.query(`ALTER TABLE graphic_compositions DROP COLUMN IF EXISTS layers;`);
  }
}
