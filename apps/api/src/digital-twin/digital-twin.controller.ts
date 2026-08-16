import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../common/guards/api-token.guard';
import { DigitalTwinService } from './digital-twin.service';
import { SetupDigitalTwinDto } from './dto/setup-digital-twin.dto';
import { GenerateFromPromptDto } from './dto/generate-from-prompt.dto';

/**
 * Identidade Digital Reutilizável — camada de CONVENIÊNCIA sobre
 * `AvatarOrchestratorModule` + `ScriptGeneratorModule` (nenhuma engine nova,
 * nenhum fornecedor novo). Ver `DigitalTwinService` para o porquê de cada
 * decisão.
 */
@UseGuards(ApiTokenGuard)
@Controller('api/v1/digital-twin')
export class DigitalTwinController {
  constructor(private readonly digitalTwin: DigitalTwinService) {}

  /**
   * Onboarding único: recebe a amostra de voz + a amostra de rosto (ambas já
   * enviadas como media_asset) e registra as duas de uma vez. Síncrono —
   * devolve os dois profiles já com status (READY ou FAILED).
   */
  @Post('setup')
  setup(@Body() dto: SetupDigitalTwinDto) {
    return this.digitalTwin.setup(dto);
  }

  /**
   * Geração por prompt simples: `{ tenant_id, prompt_tema, niche, platform }`.
   * Reaproveita a voz e o rosto já cadastrados via /setup — não recebe (nem
   * aceita) nenhum arquivo novo. Assíncrono (202) — resultado final chega
   * pelo mesmo webhook de sempre (`POST /api/v1/webhooks/avatar-video`).
   */
  @Post('generate-video')
  @HttpCode(HttpStatus.ACCEPTED)
  generateVideo(@Body() dto: GenerateFromPromptDto) {
    return this.digitalTwin.generateFromPrompt(dto);
  }
}
