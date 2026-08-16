import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AdvanceCreativeDto {
  /** Fonte de isolamento multi-tenant — usado pra buscar a sessão, sempre vindo do JWT do usuário autenticado. */
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  voiceId?: string;
}
