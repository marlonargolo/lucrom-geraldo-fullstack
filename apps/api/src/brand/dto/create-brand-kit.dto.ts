import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateBrandKitDto {
  @IsUUID()
  tenant_id: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /** [0]=primária, [1]=secundária, [2]=texto — mesma convenção do slide-template.ts. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  palette: string[];

  @IsOptional()
  @IsString()
  font_family?: string;

  @IsOptional()
  @IsString()
  logo_url?: string;

  @IsOptional()
  @IsUUID()
  niche_preset_id?: string;
}
