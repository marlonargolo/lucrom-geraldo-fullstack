import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import {
  CtaType,
  DesiredEmotion,
  PrimaryChannel,
  PsychologicalApproach,
  StrategyAngle,
} from '../strategy-brief.entity';

const ANGLES: StrategyAngle[] = ['MYTH_BUSTING', 'CONTRAST_CASE', 'BEHIND_THE_CURTAIN', 'PROVOCATIVE_QUESTION', 'REVERSE_ENGINEERING'];
const APPROACHES: PsychologicalApproach[] = ['LOSS_AVERSION', 'SOCIAL_PROOF', 'MYTH_DISRUPTION', 'AUTHORITY'];
const CHANNELS: PrimaryChannel[] = ['INSTAGRAM_REELS', 'TIKTOK', 'YOUTUBE_SHORTS', 'LINKEDIN_VIDEO'];
const EMOTIONS: DesiredEmotion[] = ['RELIEF', 'URGENCY', 'EUREKA', 'VALIDATION', 'INDIGNATION'];
const CTA_TYPES: CtaType[] = ['COMMENT_AUTOMATION', 'PROFILE_VISIT', 'DIRECT_MESSAGE', 'LINK_IN_BIO', 'SAVE_FOR_LATER'];

class TargetAudienceDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  personaName?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  manifestDesire: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  hiddenFear: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  culturalContradiction: string;
}

export class AdvanceStrategyDto {
  /** Fonte de isolamento multi-tenant — usado pra buscar a sessão, sempre vindo do JWT do usuário autenticado. */
  @IsUUID()
  tenantId: string;

  @IsUUID()
  businessTicketId: string;

  @ValidateNested()
  @Type(() => TargetAudienceDto)
  targetAudience: TargetAudienceDto;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  coreThesis: string;

  @IsIn(ANGLES)
  angle: StrategyAngle;

  @IsIn(APPROACHES)
  psychologicalApproach: PsychologicalApproach;

  @IsIn(CHANNELS)
  primaryChannel: PrimaryChannel;

  @IsIn(EMOTIONS)
  desiredEmotion: DesiredEmotion;

  @IsIn(CTA_TYPES)
  callToActionType: CtaType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  toneOfVoice?: string;
}
