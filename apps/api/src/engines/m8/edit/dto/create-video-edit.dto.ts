import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, MaxLength, ValidateNested } from 'class-validator';

class CaptionDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @IsOptional()
  @IsString()
  accent_color?: string; // hex, ex.: '#FFDD00'

  @IsOptional()
  @IsString()
  text_color?: string; // hex, ex.: '#FFFFFF'

  /** Janela de exibição da legenda, relativa ao vídeo já cortado. Padrão: do início ao fim. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  start_time_seconds?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  end_time_seconds?: number;
}

/**
 * Edição pós-geração: corta `source_asset_id` entre `start_time_seconds` e
 * `end_time_seconds`, com legenda (lower third) opcional.
 */
export class CreateVideoEditDto {
  @IsUUID()
  tenant_id: string;

  @IsUUID()
  source_asset_id: string;

  @IsNumber()
  @Min(0)
  start_time_seconds: number;

  @IsNumber()
  @IsPositive()
  end_time_seconds: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CaptionDto)
  caption?: CaptionDto;
}
