import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

class BrandKitDto {
  @IsArray()
  @IsString({ each: true })
  palette: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbidden_words?: string[];
}

/**
 * Consumido pelo `briefing-composer.tsx` do frontend: dispara a geração
 * assíncrona (202 Accepted) — o resultado final chega via BullMQ/webhook,
 * consultável depois em GET /api/v1/engines/m8/ai-video/:id.
 */
export class GenerateVideoAsyncDto {
  @IsUUID()
  tenant_id: string;

  @IsString()
  @MaxLength(4000)
  prompt: string;

  @IsIn(['9:16', '16:9', '1:1'])
  aspect_ratio: '9:16' | '16:9' | '1:1';

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandKitDto)
  brand_kit?: BrandKitDto;
}
