import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class BrandContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  palette?: string[];
}

export class PromptOptimizeDto {
  @IsString()
  @MaxLength(4000)
  prompt: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  formatId?: string;

  @IsIn(['9:16', '16:9', '1:1', '4:5'])
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  references?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandContextDto)
  brandContext?: BrandContextDto;
}

export class CreateGenerationDto {
  @IsString()
  @MaxLength(64)
  optimizationId: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  originalPrompt?: string;

  @IsIn(['9:16', '16:9', '1:1', '4:5'])
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  assetType?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandContextDto)
  brandContext?: BrandContextDto;
}
