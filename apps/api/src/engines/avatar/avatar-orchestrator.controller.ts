import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../../common/guards/api-token.guard';
import { AvatarOrchestratorService } from './avatar-orchestrator.service';
import { CloneVoiceDto } from './dto/clone-voice.dto';
import { CreateAvatarProfileDto } from './dto/create-avatar-profile.dto';
import { GenerateAvatarVideoDto } from './dto/generate-avatar-video.dto';

/**
 * Avatar Real + Voz Clonada + Lip-Sync — 100% Kling + MiniMax (mesmos
 * provedores já usados no restante do M8, sem fornecedor novo).
 *
 * Mesmo padrão assíncrono do `ai-orchestrator.controller.ts`:
 * `POST .../generate` responde 202 na hora, resultado chega via
 * `POST /api/v1/webhooks/avatar-video`.
 */
@UseGuards(ApiTokenGuard)
@Controller('api/v1/engines/avatar')
export class AvatarOrchestratorController {
  constructor(private readonly orchestrator: AvatarOrchestratorService) {}

  /** Clona uma voz a partir de uma amostra de áudio já enviada (media_asset). Síncrono. */
  @Post('voices')
  cloneVoice(@Body() dto: CloneVoiceDto) {
    return this.orchestrator.cloneVoice(dto);
  }

  /** Identifica o rosto num vídeo-fonte já enviado (media_asset), preparando para lip-sync futuro. Síncrono. */
  @Post('profiles')
  createAvatarProfile(@Body() dto: CreateAvatarProfileDto) {
    return this.orchestrator.createAvatarProfile(dto);
  }

  /** Gera o vídeo final: sintetiza a narração com a voz clonada e aplica lip-sync no rosto identificado. Assíncrono (202). */
  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  generateVideo(@Body() dto: GenerateAvatarVideoDto) {
    return this.orchestrator.generateVideo(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.orchestrator.findOneOrFail(id, tenantId);
  }

  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.orchestrator.findByTenant(tenantId);
  }
}
