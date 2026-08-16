import { IsIn, IsOptional, IsUUID } from 'class-validator';

/**
 * `tenantId` é OBRIGATÓRIO e é a fonte de isolamento em si — usado pra
 * buscar a sessão (`DirectorService.findOneOrFail(id, tenantId)`), não uma
 * checagem posterior. Sem isso, qualquer chamador que soubesse o UUID de
 * uma sessão de OUTRO tenant conseguiria lê-la/avançá-la (ver auditoria de
 * isolamento multi-tenant). O valor vem sempre do JWT do usuário
 * autenticado (`requireUser` no proxy Next.js), nunca de input livre do
 * cliente.
 */
export class AdvanceProductionDto {
  @IsUUID()
  tenantId: string;

  /** Formato do vídeo gerado. Default '9:16' — Reels/TikTok/Shorts, os canais suportados pelo Strategy Engine. */
  @IsOptional()
  @IsIn(['9:16', '16:9', '1:1'])
  aspectRatio?: '9:16' | '16:9' | '1:1';
}
