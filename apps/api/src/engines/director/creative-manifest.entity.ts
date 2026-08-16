import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Saída do Creative Engine. NÃO reimplementa geração de roteiro — reaproveita
 * `ScriptGeneratorService` (já existente, já testado, já com `LlmClientService`
 * plugado) via `DirectorService.advanceCreative`, traduzindo o `StrategyBrief`
 * pra um `GenerateScriptDto`. `script_id` aponta pra tabela `scripts` já
 * existente; esta entidade só é o elo que registra QUAL script pertence a
 * QUAL sessão do Director Engine, sem duplicar o contrato JSON.
 */
@Entity('creative_manifests')
export class CreativeManifest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  session_id: string;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid' })
  strategy_brief_id: string;

  @Column({ type: 'uuid' })
  script_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  voice_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
