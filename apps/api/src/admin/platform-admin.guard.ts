import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { User } from '../auth/user.entity';

/**
 * Libera /api/v1/admin/* só para admin de PLATAFORMA. Roda DEPOIS do
 * JwtAuthGuard (precisa de `req.user`) e consulta `users.is_platform_admin`
 * no banco a cada request — assim revogar o acesso tem efeito imediato,
 * sem esperar o JWT expirar. Nunca usa `role` (escopo de tenant).
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const userId = req.user?.sub;
    if (!userId) throw new ForbiddenException('Acesso restrito à equipe da plataforma.');

    const user = await this.users.findOne({ where: { id: userId }, select: { id: true, is_platform_admin: true } });
    if (!user?.is_platform_admin) throw new ForbiddenException('Acesso restrito à equipe da plataforma.');
    return true;
  }
}
