import { IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, Min } from 'class-validator';

export class OverlayImageDto {
  @IsUUID()
  tenant_id: string;

  /** s3_key de um media_asset de vídeo já existente (upload ou saída do M8). */
  @IsString()
  source_video_key: string;

  /** s3_key de um media_asset de imagem já existente (logo/selo, idealmente PNG com alpha). */
  @IsString()
  overlay_image_key: string;

  @IsOptional()
  @IsIn(['top_left', 'top_right', 'bottom_left', 'bottom_right', 'center'])
  position?: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'center';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  opacity?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  scale_width?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  start_time?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  end_time?: number;
}
