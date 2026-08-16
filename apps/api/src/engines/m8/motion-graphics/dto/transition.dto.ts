import { IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class TransitionDto {
  @IsUUID()
  tenant_id: string;

  /** s3_key do primeiro clipe (media_asset já existente). */
  @IsString()
  first_clip_key: string;

  /** s3_key do segundo clipe (media_asset já existente). */
  @IsString()
  second_clip_key: string;

  @IsOptional()
  @IsIn(['fade', 'wipeleft', 'wiperight', 'slideup', 'slidedown', 'circleopen', 'circleclose', 'dissolve'])
  transition?: 'fade' | 'wipeleft' | 'wiperight' | 'slideup' | 'slidedown' | 'circleopen' | 'circleclose' | 'dissolve';

  @IsOptional()
  @IsNumber()
  @IsPositive()
  duration_seconds?: number;
}
