import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { ReplicateClientService } from './replicate-client.service';

/**
 * Etapa 1 da Especificação Técnica de Arquitetura — Audio Clean & Sync:
 * "Isolamento vocal e transcrição milimétrica palavra por palavra."
 * Tecnologias: DeepFilterNet / ElevenLabs Audio Isolation + WhisperX.
 *
 * IMPLEMENTAÇÃO:
 * • Isolamento vocal via DeepFilterNet hospedado no Replicate (adiabatic/deepfilternet).
 *   Remove ruído de fundo (tráfego, ar-condicionado, reverberação) sem distorcer a voz.
 * • Transcrição word-level via WhisperX hospedado no Replicate (victor-upmeet/whisperx).
 *   Retorna timestamps de início/fim por palavra — base para o drawtext sincronizado (Etapa 4).
 *
 * Ambas as etapas são opcionais individualmente: o caller controla via
 * `runIsolation` e `runTranscription`. Se o REPLICATE_API_TOKEN não estiver
 * configurado, os modelos são ignorados com aviso em log e o áudio original
 * é mantido, garantindo que o pipeline não quebre.
 */

export interface WordTimestamp {
  word: string;
  start: number; // segundos
  end: number;   // segundos
}

export interface AudioCleanResult {
  /** Caminho local do áudio isolado (wav/mp4). Null se o isolamento não rodou. */
  cleanedAudioPath: string | null;
  /** Timestamps word-level do WhisperX. Vazio se a transcrição não rodou. */
  wordTimestamps: WordTimestamp[];
  /** Transcrição completa. Vazio se a transcrição não rodou. */
  transcription: string;
}

/** Saída crua do WhisperX via Replicate. */
interface WhisperXOutput {
  segments?: Array<{
    text?: string;
    words?: Array<{ word: string; start: number; end: number }>;
  }>;
  text?: string;
}

@Injectable()
export class AudioCleanService {
  private readonly logger = new Logger(AudioCleanService.name);
  private readonly deepFilterNetModel: string;
  private readonly whisperXModel: string;

  constructor(
    private readonly replicate: ReplicateClientService,
    private readonly config: ConfigService,
  ) {
    this.deepFilterNetModel =
      this.config.get<string>('generative.models.deepFilterNet') ??
      'adirik/deepfilternet:latest';
    this.whisperXModel =
      this.config.get<string>('generative.models.whisperX') ??
      'victor-upmeet/whisperx:84d2ad2d6194fe98efb918a5bc05c61ebef18cce5d77c7a7ce5b1b6b7cfd7c7f';
  }

  private tmp(ext: string) {
    return path.join(os.tmpdir(), `lucrom-m8-audio-${randomUUID()}.${ext}`);
  }

  /**
   * Pipeline completo de limpeza de áudio:
   * 1. Extrai a faixa de áudio do vídeo (AAC→WAV, mono 16 kHz, formato aceito pelos modelos).
   * 2. Roda DeepFilterNet para isolamento vocal.
   * 3. Roda WhisperX para transcrição + timestamps word-level.
   *
   * @param videoPath   caminho local do vídeo bruto
   * @param options.runIsolation    se true, roda DeepFilterNet (default: true)
   * @param options.runTranscription se true, roda WhisperX (default: true)
   * @param options.language        idioma para o WhisperX (default: 'pt')
   */
  async process(
    videoPath: string,
    options: { runIsolation?: boolean; runTranscription?: boolean; language?: string } = {},
  ): Promise<AudioCleanResult> {
    const { runIsolation = true, runTranscription = true, language = 'pt' } = options;

    // Extrai áudio como WAV mono 16 kHz — formato universal para modelos de áudio.
    const rawAudioPath = await this.extractAudio(videoPath);
    const tmpFiles: string[] = [rawAudioPath];

    let cleanedAudioPath: string | null = null;
    let wordTimestamps: WordTimestamp[] = [];
    let transcription = '';

    try {
      // Etapa 1a: Isolamento vocal via DeepFilterNet
      if (runIsolation) {
        cleanedAudioPath = await this.runDeepFilterNet(rawAudioPath).catch((err) => {
          this.logger.warn(`DeepFilterNet falhou — usando áudio original: ${err.message}`);
          return null;
        });
        if (cleanedAudioPath) tmpFiles.push(cleanedAudioPath);
      }

      // Etapa 1b: Transcrição word-level via WhisperX
      const audioForTranscription = cleanedAudioPath ?? rawAudioPath;
      if (runTranscription) {
        const result = await this.runWhisperX(audioForTranscription, language).catch((err) => {
          this.logger.warn(`WhisperX falhou — legendas serão omitidas: ${err.message}`);
          return null;
        });
        if (result) {
          wordTimestamps = result.wordTimestamps;
          transcription = result.transcription;
        }
      }

      return { cleanedAudioPath, wordTimestamps, transcription };
    } finally {
      // Limpa temporários que NÃO são o resultado (rawAudio sempre, cleanedAudio só se falhou).
      for (const p of tmpFiles) {
        if (p !== cleanedAudioPath) {
          await fs.rm(p, { force: true }).catch(() => undefined);
        }
      }
    }
  }

  /** Extrai a faixa de áudio do vídeo como WAV mono 16 kHz. */
  private async extractAudio(videoPath: string): Promise<string> {
    const outPath = this.tmp('wav');
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioChannels(1)
        .audioFrequency(16000)
        .audioCodec('pcm_s16le')
        .output(outPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
    return outPath;
  }

  /** Roda DeepFilterNet no Replicate para isolar a voz do áudio de entrada. */
  private async runDeepFilterNet(audioPath: string): Promise<string> {
    this.logger.log('Rodando DeepFilterNet (isolamento vocal)…');
    const buffer = await fs.readFile(audioPath);
    const dataUri = this.replicate.toDataUri(buffer, 'audio/wav');

    const output = await this.replicate.run(this.deepFilterNetModel, {
      audio: dataUri,
    });

    const outputUrl =
      typeof output === 'string'
        ? output
        : (output as { audio?: string })?.audio ?? '';

    if (!outputUrl) {
      throw new Error(`DeepFilterNet não retornou URL de áudio válida.`);
    }

    const cleanedBuffer = await this.replicate.downloadOutput(outputUrl);
    const cleanedPath = this.tmp('wav');
    await fs.writeFile(cleanedPath, cleanedBuffer);
    this.logger.log('DeepFilterNet concluído.');
    return cleanedPath;
  }

  /** Roda WhisperX no Replicate para obter timestamps word-level. */
  private async runWhisperX(
    audioPath: string,
    language: string,
  ): Promise<{ wordTimestamps: WordTimestamp[]; transcription: string }> {
    this.logger.log(`Rodando WhisperX (transcrição word-level, idioma=${language})…`);
    const buffer = await fs.readFile(audioPath);
    const dataUri = this.replicate.toDataUri(buffer, 'audio/wav');

    const output = (await this.replicate.run(this.whisperXModel, {
      audio: dataUri,
      language,
      align_output: true, // ativa word-level alignment no whisperx
    })) as WhisperXOutput;

    const wordTimestamps: WordTimestamp[] = [];
    let fullText = output?.text ?? '';

    if (output?.segments) {
      for (const seg of output.segments) {
        if (seg.words) {
          for (const w of seg.words) {
            if (w.word && typeof w.start === 'number' && typeof w.end === 'number') {
              wordTimestamps.push({ word: w.word.trim(), start: w.start, end: w.end });
            }
          }
        }
      }
    }

    this.logger.log(`WhisperX: ${wordTimestamps.length} palavras alinhadas.`);
    return { wordTimestamps, transcription: fullText };
  }

  /** Remove arquivos temporários gerados por este serviço. */
  async cleanup(...paths: (string | null | undefined)[]) {
    for (const p of paths) {
      if (p) await fs.rm(p, { force: true }).catch(() => undefined);
    }
  }
}
