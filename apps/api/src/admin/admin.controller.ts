import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';
import { PlatformAdminGuard } from './platform-admin.guard';

/** Painel /studio/admin — só admin de PLATAFORMA (JWT + users.is_platform_admin). */
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('activity')
  activity(@Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number) {
    return this.admin.activity(Math.min(Math.max(limit, 1), 100));
  }

  @Get('risk-alerts')
  riskAlerts(@Query('thresholdPerHour', new DefaultValuePipe(20), ParseIntPipe) thresholdPerHour: number) {
    return this.admin.riskAlerts(Math.max(thresholdPerHour, 1));
  }
}
