import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Módulo Ajuste Rápido Humano — só os campos determinísticos listados no
 * doc do módulo (seção 2/6) existem aqui DE PROPÓSITO. Não há campo pra
 * "gerar nova imagem de fundo" ou qualquer coisa generativa: isso continua
 * sendo um novo `POST /api/v1/graphics/compose`, não um ajuste.
 */
class GraphicLayerStylePatchDto {
  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(400)
  fontSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  fontFamily?: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(900)
  fontWeight?: number;

  @IsOptional()
  @IsIn(['left', 'center', 'right'])
  align?: 'left' | 'center' | 'right';

  @IsOptional()
  @IsIn(['top', 'center', 'bottom'])
  verticalPosition?: 'top' | 'center' | 'bottom';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  opacity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(400)
  spacingBottom?: number;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  /** Troca de ativo (imagem/logo/fundo) — sempre um asset JÁ EXISTENTE (upload ou geração anterior), nunca gerado aqui. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  assetUrl?: string;
}

class LayerUpdateDto {
  @IsInt()
  @Min(0)
  slide_index: number;

  @IsString()
  layer_id: string;

  /** Edição direta de texto — não é operação generativa, é o usuário reescrevendo o próprio texto. */
  @IsOptional()
  @IsString()
  @MaxLength(600)
  content?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GraphicLayerStylePatchDto)
  style?: GraphicLayerStylePatchDto;
}

export class UpdateGraphicLayersDto {
  @IsUUID()
  tenant_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LayerUpdateDto)
  updates: LayerUpdateDto[];

  /** Nota livre do usuário sobre o ajuste (ex.: "fonte menor no título") — vira `note` no snapshot do histórico. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
