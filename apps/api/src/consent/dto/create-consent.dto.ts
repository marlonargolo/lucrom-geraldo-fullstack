import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateConsentDto {
  @IsUUID()
  tenant_id: string;

  @IsIn(['face', 'voice'])
  subject_type: 'face' | 'voice';

  @IsString()
  @MinLength(2)
  subject_name: string;

  @IsOptional()
  @IsString()
  contract_s3_key?: string;

  @IsOptional()
  @IsISO8601()
  expires_at?: string;
}
