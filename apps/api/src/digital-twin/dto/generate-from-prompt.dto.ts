import { IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from 'class-validator';

/** Mesmo conjunto de `GenerateScriptDto` (creative/script-generator) — mantido idêntico de propósito. */
type NicheType = 'marcenaria' | 'farmacia' | 'mercado' | 'escritorio';
type PlatformType = 'instagram_reels' | 'tiktok' | 'youtube_shorts' | 'instagram_feed' | 'instagram_carousel';

/**
 * "Prompt simples" pedido no fluxo B: o tenant já fez o setup uma vez
 * (`POST /api/v1/digital-twin/setup`) e agora só manda o tema — nem
 * script_text, nem ids de voz/avatar, nem re-upload de nada.
 */
export class GenerateFromPromptDto {
  @IsUUID()
  tenant_id: string;

  /** Tema livre do vídeo (ex.: "promoção de fim de ano da loja"). Vira o `brief` do ScriptGeneratorService. */
  @IsString()
  @MaxLength(4000)
  prompt_tema: string;

  @IsIn(['marcenaria', 'farmacia', 'mercado', 'escritorio'] as NicheType[])
  niche: NicheType;

  @IsIn(['instagram_reels', 'tiktok', 'youtube_shorts', 'instagram_feed', 'instagram_carousel'] as PlatformType[])
  platform: PlatformType;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  target_duration_seconds?: number;

  @IsOptional()
  @IsIn(['9:16', '16:9', '1:1'])
  aspect_ratio?: '9:16' | '16:9' | '1:1';
}
