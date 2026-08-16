import { IsUUID } from 'class-validator';

/** tenant_id da sessão é SEMPRE derivado do brand kit (nunca aceito como fonte de verdade) — `tenantId` aqui só confere que o chamador (JWT) é dono do brand que está pedindo. */
export class CreateSessionDto {
  @IsUUID()
  tenantId: string;

  @IsUUID()
  brandId: string;
}
