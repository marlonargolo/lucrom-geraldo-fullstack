import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

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

  /**
   * Aceite obrigatório: versão dos Termos de Uso e da Política de
   * Privacidade exibidas ao usuário no momento do cadastro (ver
   * apps/web/lib/legal/policies.ts — LEGAL_POLICY_VERSIONS).
   */
  @IsString()
  @IsNotEmpty({ message: 'Aceite os Termos de Uso e a Política de Privacidade.' })
  @MaxLength(80)
  termsVersion: string;

  @IsString()
  @IsNotEmpty({ message: 'Aceite os Termos de Uso e a Política de Privacidade.' })
  @MaxLength(80)
  privacyVersion: string;
}
