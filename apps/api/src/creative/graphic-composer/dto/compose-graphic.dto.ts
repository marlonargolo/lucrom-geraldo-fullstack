import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class BrandKitDto {
  @IsArray()
  @IsString({ each: true })
  palette: string[]; // hex, [0]=primária, [1]=secundária, [2]=texto (convenção do template)

  @IsOptional()
  @IsString()
  font_family?: string; // ex.: 'Helvetica', 'Georgia' — deve estar disponível no Chromium do Puppeteer

  @IsOptional()
  @IsString()
  logo_url?: string; // URL pública ou data URI, opcional
}

export class GraphicSlideDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  footer?: string;
}

/**
 * Lacuna 2 — Contrato de composição de carrossel (múltiplos slides, 1080x1350
 * recomendado) ou arte estática (1 slide, 1080x1350 ou 1080x1920).
 */
export class ComposeGraphicDto {
  @IsUUID()
  tenant_id: string;

  @IsIn(['carousel', 'static_art'])
  kind: 'carousel' | 'static_art';

  @IsIn(['1080x1350', '1080x1920'])
  format: '1080x1350' | '1080x1920';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => GraphicSlideDto)
  slides: GraphicSlideDto[];

  @ValidateNested()
  @Type(() => BrandKitDto)
  brand_kit: BrandKitDto;
}
