import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload } from '../../auth/auth.service';
import { BriefingService } from './briefing.service';
import { CreateGenerationDto, PromptOptimizeDto } from './dto/prompt-optimize.dto';

/** Briefing do Estúdio — tenantId SEMPRE do JWT, nunca do corpo. */
@UseGuards(JwtAuthGuard)
@Controller('api/v1/ai')
export class BriefingController {
  constructor(private readonly briefing: BriefingService) {}

  @Post('prompt-optimize')
  @HttpCode(HttpStatus.OK)
  optimize(@Req() req: Request & { user: JwtPayload }, @Body() dto: PromptOptimizeDto) {
    return this.briefing.optimize(req.user.tenantId, dto);
  }

  /** 202 Accepted — o vídeo chega depois via webhook (mesmo fluxo de /engines/m8/ai-video/generate). */
  @Post('generations')
  @HttpCode(HttpStatus.ACCEPTED)
  createGeneration(@Req() req: Request & { user: JwtPayload }, @Body() dto: CreateGenerationDto) {
    return this.briefing.createGeneration(req.user.tenantId, dto);
  }
}
