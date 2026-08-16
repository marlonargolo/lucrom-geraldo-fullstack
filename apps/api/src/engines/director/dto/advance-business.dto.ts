import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { BusinessProblemCategory } from '../business-ticket.entity';

const CATEGORIES: BusinessProblemCategory[] = ['HIGH_CAC', 'LOW_AWARENESS', 'POOR_CONVERSION', 'BRAND_EROSION'];

export class AdvanceBusinessDto {
  /** Fonte de isolamento multi-tenant — usado pra buscar a sessão, sempre vindo do JWT do usuário autenticado. */
  @IsUUID()
  tenantId: string;

  @IsUUID()
  brandId: string;

  @IsIn(CATEGORIES)
  problemCategory: BusinessProblemCategory;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  problemDescription: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  targetMetric: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetValue?: string;
}
