import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateNichePresetDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  key: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  label: string;

  @IsOptional()
  @IsString()
  description?: string;
}
