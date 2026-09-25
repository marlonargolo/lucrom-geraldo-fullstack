import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;

  @IsString()
  @Matches(PASSWORD_RULE, { message: 'Senha deve ter 8+ caracteres, com ao menos 1 letra e 1 número.' })
  password: string;
}
