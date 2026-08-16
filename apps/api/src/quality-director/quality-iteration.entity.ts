import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RenderJob } from '../engines/m8/render-job.entity';

/**
 * Cada linha é uma passada do "AI Quality Director": diagnóstico (nota +
 * justificativa por eixo) antes/depois de aplicar uma correção. Não existia
 * no schema original — extensão necessária para o loop iterativo pedido no
 * Documento de Diretrizes de Engenharia Audiovisual Premium.
 */
@Entity('quality_iterations')
export class QualityIteration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => RenderJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'render_job_id' })
  renderJob: RenderJob;

  @Index()
  @Column({ type: 'uuid' })
  render_job_id: string;

  @Column({ type: 'int' })
  iteration_number: number;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  overall_score: number;

  @Column({ type: 'boolean' })
  passed: boolean;

  /** Breakdown completo por eixo (score, ok, justificativa, peso) — nunca caixa-preta. */
  @Column({ type: 'jsonb' })
  axes: unknown;

  /** Parâmetros de correção aplicados APÓS este diagnóstico (null na última iteração, quando já passou ou esgotou). */
  @Column({ type: 'jsonb', nullable: true })
  correction_applied: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
