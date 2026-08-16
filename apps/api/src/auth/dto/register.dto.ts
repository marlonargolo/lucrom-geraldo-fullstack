import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Regra mínima de senha: 8+ caracteres, ao menos 1 letra e 1 número —
 * equilíbrio entre segurança e não fazer o usuário leigo (MEI, público-alvo
 * do produto) desistir do cadastro.
 */
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

/**
 * Auto-cadastro (MEI): não recebe `tenant_id`. O registro CRIA um tenant
 * novo automaticamente (plano CREATOR — ver AuthService.register).
 * `businessName` é opcional e vira o nome desse tenant; se omitido, cai
 * pra algo derivado do e-mail.
 */
export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @Matches(PASSWORD_RULE, { message: 'Senha deve ter 8+ caracteres, com ao menos 1 letra e 1 número.' })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessName?: string;
}
