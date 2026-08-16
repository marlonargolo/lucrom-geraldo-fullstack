import { Controller, Get } from '@nestjs/common';

@Controller('api')
export class HealthController {
  @Get('healthz')
  check() {
    return {
      status: 'ok',
      service: 'LUCROM Studio AI',
      timestamp: new Date().toISOString(),
    };
  }
}
