import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsIn(['CREATOR', 'ENTERPRISE'])
  plan_tier?: 'CREATOR' | 'ENTERPRISE';
}
