import { Type } from 'class-transformer';
import { ArrayMinSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

const ALL_FORMATS = ['reels', 'story', 'feed_square', 'feed_portrait', 'carousel'] as const;
export type ExportFormatKindDto = (typeof ALL_FORMATS)[number];

/** Mesmo shape do `brand_kit` de `ComposeGraphicDto` (Lacuna 2) — necessário só quando `carousel` é pedido. */
class ExportBrandKitDto {
  @IsArray()
  @IsString({ each: true })
  palette: string[];

  @IsOptional()
  @IsString()
  font_family?: string;

  @IsOptional()
  @IsString()
  logo_url?: string;
}

/**
 * Export automático multi-formato: gera, a partir de `source_asset_id`, as
 * variantes pedidas em `formats` (padrão: todas as 5) de uma vez só.
 *
 * `script_id` + `brand_kit` só são obrigatórios se `carousel` estiver entre
 * os formatos pedidos (é o que alimenta o texto/paleta do carrossel) — a
 * ausência deles não derruba os outros formatos, só faz o carrossel falhar
 * isoladamente (ver `FormatExportService`).
 */
export class CreateFormatExportDto {
  @IsUUID()
  tenant_id: string;

  @IsUUID()
  source_asset_id: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(ALL_FORMATS, { each: true })
  formats?: ExportFormatKindDto[];

  @IsOptional()
  @IsUUID()
  script_id?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExportBrandKitDto)
  brand_kit?: ExportBrandKitDto;
}

export { ALL_FORMATS };
