import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * Únicas rotas públicas (sem ApiTokenGuard/JwtAuthGuard) do backend — todo o
 * resto da API continua atrás de ApiTokenGuard (serviço-a-serviço) ou
 * JwtAuthGuard (sessão de usuário, ex.: BrandController).
 */
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const clientIp = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return this.auth.login(dto, clientIp);
  }
}
