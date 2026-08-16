import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../common/guards/api-token.guard';
import { QualityIterationsService } from './quality-iterations.service';

@UseGuards(ApiTokenGuard)
@Controller('api/v1/quality-iterations')
export class QualityIterationsController {
  constructor(private readonly qualityIterations: QualityIterationsService) {}

  @Get('render-job/:renderJobId')
  findByRenderJob(@Param('renderJobId') renderJobId: string) {
    return this.qualityIterations.findByRenderJob(renderJobId);
  }
}
