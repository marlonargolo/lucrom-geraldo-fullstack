import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Tenant } from '../../tenants/tenant.entity';
import { ReplicateClientService } from '../../engines/m8/replicate-client.service';
import { MediaAssetsService } from '../../media-assets/media-assets.service';
import { LlmClientService } from '../llm/llm-client.service';
import { VoiceCommand } from './voice-command.entity';

/**
 * Lacuna 3 — Extensão do pipeline WhisperX (já usado pelo AudioCleanService,
 * engines/m8/audio-clean.service.ts) para processar comandos de voz DIRETOS
 * do usuário, e não apenas narração de vídeo a legendar.
 *
 * Fluxo:
 *   1. Usuário grava/envia um áudio curto (ex.: "gera um roteiro pra reels de
 *      farmácia sobre promoção de vitamina D, uns 20 segundos").
 *   2. WhisperX (Replicate, MESMO modelo/config do AudioCleanService) transcreve.
 *   3. O transcript é enviado ao LLM (LlmClientService) para virar um "intent"
 *      estruturado — qual ação o usuário quer (gerar roteiro, compor arte,
 *      renderizar vídeo) e com quais parâmetros.
 *
 * O `intent` retornado é DELIBERADAMENTE genérico (action + params) para que
 * o Frontend decida como/quando disparar a chamada correspondente
 * (POST /api/v1/scripts/generate, POST /api/v1/graphics/compose ou
 * POST /api/v1/engines/m8/render) — este serviço não dispara essas chamadas
 * sozinho, evitando efeitos colaterais não confirmados pelo usuário.
 */
export type VoiceCommandAction = 'GENERATE_SCRIPT' | 'COMPOSE_GRAPHIC' | 'RENDER_VIDEO' | 'UNKNOWN';

export interface VoiceCommandIntent {
  action: VoiceCommandAction;
  /** Parâmetros livres, moldados conforme a ação (ex.: niche, platform, brief para GENERATE_SCRIPT). */
  params: Record<string, unknown>;
  /** 0..1 — confiança do LLM na interpretação; abaixo de 0.5 o Frontend deve confirmar com o usuário. */
  confidence: number;
  /** Explicação curta em pt-BR do que foi entendido, para exibir ao usuário antes de confirmar a ação. */
  summary: string;
}

@Injectable()
export class VoiceCommandService {
  private readonly logger = new Logger(VoiceCommandService.name);
  private readonly whisperXModel: string;

  constructor(
    @InjectRepository(VoiceCommand) private readonly voiceCommands: Repository<VoiceCommand>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly replicate: ReplicateClientService,
    private readonly mediaAssets: MediaAssetsService,
    private readonly llm: LlmClientService,
    private readonly config: ConfigService,
  ) {
    // Mesmo default do AudioCleanService — reaproveita o modelo já validado em produção.
    this.whisperXModel =
      this.config.get<string>('generative.models.whisperX') ??
      'victor-upmeet/whisperx:84d2ad2d6194fe98efb918a5bc05c61ebef18cce5d77c7a7ce5b1b6b7cfd7c7f';
  }

  async interpret(params: {
    tenantId: string;
    audioBuffer: Buffer;
    mimeType: string;
    language?: string;
  }): Promise<VoiceCommand> {
    if (!this.replicate) {
      throw new ServiceUnavailableException('Replicate não configurado — transcrição de comandos de voz indisponível.');
    }
    if (!this.llm.isConfigured) {
      throw new ServiceUnavailableException('LLM_API_KEY não configurado — interpretação de comandos de voz indisponível.');
    }

    const tenant = await this.tenants.findOne({ where: { id: params.tenantId } });
    if (!tenant) throw new BadRequestException(`Tenant ${params.tenantId} não encontrado.`);

    // Registra o áudio original como media_asset — auditoria e possível replay/depuração.
    const audioAsset = await this.mediaAssets.uploadAndRegister({
      tenantId: params.tenantId,
      buffer: params.audioBuffer,
      contentType: params.mimeType,
      fileType: params.mimeType,
      engineSource: 'VOICE_COMMAND',
    });

    let transcript = '';
    let intent: VoiceCommandIntent;

    try {
      transcript = await this.transcribe(params.audioBuffer, params.language ?? 'pt');
      if (!transcript.trim()) {
        throw new Error('WhisperX não retornou nenhuma transcrição (áudio vazio ou inaudível).');
      }
      intent = await this.interpretTranscript(transcript);
    } catch (err) {
      const failed = this.voiceCommands.create({
        tenant_id: params.tenantId,
        transcript,
        intent: {},
        audio_asset_id: audioAsset.id,
        status: 'FAILED',
        error_message: (err as Error).message,
      });
      await this.voiceCommands.save(failed);
      throw new BadRequestException(`Falha ao interpretar comando de voz: ${(err as Error).message}`);
    }

    const saved = this.voiceCommands.create({
      tenant_id: params.tenantId,
      transcript,
      intent: intent as unknown as Record<string, unknown>,
      audio_asset_id: audioAsset.id,
      status: 'DONE',
    });
    return this.voiceCommands.save(saved);
  }

  findOneOrFail(id: string, tenantId: string) {
    return this.voiceCommands.findOneOrFail({ where: { id, tenant_id: tenantId } });
  }

  findByTenant(tenantId: string) {
    return this.voiceCommands.find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' } });
  }

  /** Roda o WhisperX no Replicate sobre o buffer de áudio bruto (sem exigir alinhamento word-level). */
  private async transcribe(audioBuffer: Buffer, language: string): Promise<string> {
    this.logger.log(`Transcrevendo comando de voz via WhisperX (idioma=${language})…`);

    // WhisperX aceita a maioria dos formatos de áudio comuns (webm/mp3/wav/m4a)
    // diretamente via data URI — não é necessário reencodar antes de enviar.
    const dataUri = this.replicate.toDataUri(audioBuffer, 'audio/webm');

    const output = (await this.replicate.run(this.whisperXModel, {
      audio: dataUri,
      language,
      align_output: false, // comando de voz não precisa de timestamps por palavra, só o texto
    })) as { text?: string; segments?: Array<{ text?: string }> };

    if (output?.text) return output.text.trim();
    if (output?.segments?.length) {
      return output.segments.map((s) => s.text ?? '').join(' ').trim();
    }
    return '';
  }

  /** Usa o LLM para converter o transcript livre num intent estruturado e acionável. */
  private async interpretTranscript(transcript: string): Promise<VoiceCommandIntent> {
    const system =
      'Você interpreta comandos de voz transcritos de usuários de uma plataforma de criação de conteúdo ' +
      'para pequenos negócios brasileiros (marcenaria, farmácia, mercado, escritório). ' +
      'Classifique a intenção do usuário em UMA das ações: GENERATE_SCRIPT (quer um roteiro/copy), ' +
      'COMPOSE_GRAPHIC (quer um carrossel ou arte estática), RENDER_VIDEO (quer processar/editar um vídeo ' +
      'já gravado) ou UNKNOWN (não ficou claro). Extraia os parâmetros mencionados (nicho, plataforma, ' +
      'tema/briefing, duração) quando existirem.';

    const prompt = [
      `Transcrição do comando de voz: """${transcript}"""`,
      '',
      'Responda SOMENTE com um JSON no formato exato:',
      JSON.stringify(
        {
          action: 'GENERATE_SCRIPT',
          params: { niche: 'farmacia', platform: 'instagram_reels', brief: '...', target_duration_seconds: 20 },
          confidence: 0.85,
          summary: 'Resumo curto em pt-BR do que foi entendido.',
        },
        null,
        2,
      ),
      '',
      'Se a ação não ficar clara, use action="UNKNOWN", params={} e confidence baixo (<0.4).',
    ].join('\n');

    return this.llm.completeJson<VoiceCommandIntent>({ system, prompt, maxTokens: 800, temperature: 0.3 });
  }
}
