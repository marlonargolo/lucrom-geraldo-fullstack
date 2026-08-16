import { IsNumber, IsOptional, IsString, IsUUID, Max, Min, MaxLength } from 'class-validator';

export class LowerThirdDto {
  @IsUUID()
  tenant_id: string;

  @IsString()
  source_video_key: string;

  @IsString()
  @MaxLength(80)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  subtitle?: string;

  @IsNumber()
  @Min(0)
  start_time: number;

  @IsNumber()
  @Min(0)
  end_time: number;

  @IsOptional()
  @IsString()
  accent_color?: string; // hex

  @IsOptional()
  @IsString()
  text_color?: string; // hex
}
