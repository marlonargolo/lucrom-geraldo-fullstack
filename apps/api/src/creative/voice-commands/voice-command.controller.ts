import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTokenGuard } from '../../common/guards/api-token.guard';
import { VoiceCommandService } from './voice-command.service';
import { InterpretVoiceCommandDto } from './dto/voice-command.dto';

/**
 * Lacuna 3 — Endpoint para o cliente Frontend enviar um áudio gravado (comando
 * de voz) e receber de volta a transcrição + o intent estruturado, que o
 * Frontend usa para decidir se dispara /scripts/generate, /graphics/compose
 * ou /engines/m8/render — com confirmação do usuário quando `confidence` for baixo.
 */
@UseGuards(ApiTokenGuard)
@Controller('api/v1/voice-commands')
export class VoiceCommandController {
  constructor(private readonly voiceCommands: VoiceCommandService) {}

  @Post('interpret')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }))
  async interpret(@UploadedFile() file: Express.Multer.File, @Body() dto: InterpretVoiceCommandDto) {
    if (!file) throw new BadRequestException('Campo "file" (multipart/form-data) com o áudio é obrigatório.');

    return this.voiceCommands.interpret({
      tenantId: dto.tenant_id,
      audioBuffer: file.buffer,
      mimeType: file.mimetype || 'audio/webm',
      language: dto.language,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.voiceCommands.findOneOrFail(id, tenantId);
  }

  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.voiceCommands.findByTenant(tenantId);
  }
}
