import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type StrategyAngle = 'MYTH_BUSTING' | 'CONTRAST_CASE' | 'BEHIND_THE_CURTAIN' | 'PROVOCATIVE_QUESTION' | 'REVERSE_ENGINEERING';
export type PsychologicalApproach = 'LOSS_AVERSION' | 'SOCIAL_PROOF' | 'MYTH_DISRUPTION' | 'AUTHORITY';
export type PrimaryChannel = 'INSTAGRAM_REELS' | 'TIKTOK' | 'YOUTUBE_SHORTS' | 'LINKEDIN_VIDEO';
export type DesiredEmotion = 'RELIEF' | 'URGENCY' | 'EUREKA' | 'VALIDATION' | 'INDIGNATION';
export type CtaType = 'COMMENT_AUTOMATION' | 'PROFILE_VISIT' | 'DIRECT_MESSAGE' | 'LINK_IN_BIO' | 'SAVE_FOR_LATER';

export interface TargetAudience {
  personaName?: string;
  manifestDesire: string;
  hiddenFear: string;
  culturalContradiction: string;
}

/**
 * Saída do Strategy Engine — o "Algoritmo de Conflito Triplo" citado nos
 * comentários do `real-pipeline-panel.tsx` (desejo manifesto × medo oculto ×
 * contradição cultural). Diferente do Business Engine, este estágio não tem
 * regra de rejeição automática: os campos já vêm estruturados e validados
 * (enums fechados) do frontend, o motor só persiste e sequencia.
 */
@Entity('strategy_briefs')
export class StrategyBrief {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  session_id: string;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid' })
  business_ticket_id: string;

  @Column({ type: 'jsonb' })
  target_audience: TargetAudience;

  @Column({ type: 'text' })
  core_thesis: string;

  @Column({ type: 'varchar', length: 30 })
  angle: StrategyAngle;

  @Column({ type: 'varchar', length: 30 })
  psychological_approach: PsychologicalApproach;

  @Column({ type: 'varchar', length: 30 })
  primary_channel: PrimaryChannel;

  @Column({ type: 'varchar', length: 20 })
  desired_emotion: DesiredEmotion;

  @Column({ type: 'varchar', length: 30 })
  call_to_action_type: CtaType;

  @Column({ type: 'varchar', length: 200, nullable: true })
  tone_of_voice: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
