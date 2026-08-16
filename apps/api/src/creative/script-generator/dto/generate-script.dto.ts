import { IsArray, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from 'class-validator';

/** Nichos suportados — mesmo conjunto usado pelo NichePresetService (engines/m8). */
type NicheType = 'marcenaria' | 'farmacia' | 'mercado' | 'escritorio';

/** Plataformas de destino — cada uma tem convenções próprias de tom/duração/CTA. */
type PlatformType = 'instagram_reels' | 'tiktok' | 'youtube_shorts' | 'instagram_feed' | 'instagram_carousel';

export class GenerateScriptDto {
  @IsUUID()
  tenant_id: string;

  /** Descrição livre do que o vídeo/post deve comunicar (produto, oferta, dor do cliente etc.). */
  @IsString()
  @MaxLength(4000)
  brief: string;

  @IsIn(['marcenaria', 'farmacia', 'mercado', 'escritorio'] as NicheType[])
  niche: NicheType;

  @IsIn(['instagram_reels', 'tiktok', 'youtube_shorts', 'instagram_feed', 'instagram_carousel'] as PlatformType[])
  platform: PlatformType;

  /** Duração alvo em segundos (para vídeo) — orienta o LLM a dimensionar os segmentos do roteiro. */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  target_duration_seconds?: number;

  /** Tom de voz desejado (ex.: "descontraído", "técnico", "urgente"). Padrão: definido pelo nicho. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tone_of_voice?: string;

  /** Palavras/expressões proibidas (reaproveita o conceito de brand_kit.forbidden_words do M8). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbidden_words?: string[];
}
