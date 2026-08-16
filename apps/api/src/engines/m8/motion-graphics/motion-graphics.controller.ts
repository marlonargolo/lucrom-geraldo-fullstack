import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../../../common/guards/api-token.guard';
import { MotionGraphicsService } from './motion-graphics.service';
import { OverlayImageDto } from './dto/overlay-image.dto';
import { LowerThirdDto } from './dto/lower-third.dto';
import { TransitionDto } from './dto/transition.dto';

/**
 * Lacuna 4 + 5 — Endpoints para o cliente Frontend aplicar camadas de motion
 * graphics sobre vídeos já enviados (upload) ou já processados pelo M8.
 * Cada endpoint retorna o `media_asset` de saída (novo vídeo), no mesmo
 * formato de GET /api/v1/media-assets/:id.
 */
@UseGuards(ApiTokenGuard)
@Controller('api/v1/engines/m8/motion-graphics')
export class MotionGraphicsController {
  constructor(private readonly motionGraphics: MotionGraphicsService) {}

  @Post('overlay')
  overlay(@Body() dto: OverlayImageDto) {
    return this.motionGraphics.overlayImage(dto);
  }

  @Post('lower-third')
  lowerThird(@Body() dto: LowerThirdDto) {
    return this.motionGraphics.renderLowerThird(dto);
  }

  @Post('transition')
  transition(@Body() dto: TransitionDto) {
    return this.motionGraphics.applyTransition(dto);
  }
}
