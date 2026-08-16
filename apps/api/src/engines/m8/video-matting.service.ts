import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { ReplicateClientService } from './replicate-client.service';

/**
 * ADIÇÃO NOVA — Etapa 2 da Especificação Técnica de Arquitetura, Seção 2:
 * "Video Matting: Recorte de fundo da pessoa sem necessidade de fundo verde (chroma key).
 * Robust Video Matting (RVM) / Bria AI Video Matting."
 * E Seção 5, diretriz 2: "Configure o pipeline de vídeo para aplicar recorte de fundo
 * transparente (Robust Video Matting) e mesclá-lo com a imagem do preset de nicho selecionado."
 *
 * O RVM hospedado na Replicate retorna, tipicamente, um vídeo composto sobre fundo verde
 * saturado (chroma verde puro, ex.: #00FF00) — a "não necessidade de fundo verde físico
 * na gravação" descrita no documento refere-se à captura original (o usuário grava em
 * qualquer ambiente), não ao formato de saída do modelo. Este serviço então usa o filtro
 * `colorkey`/`chromakey` do ffmpeg (matting matemático, sem gravação em estúdio) sobre
 * ESSE fundo verde sintético gerado pelo modelo, produzindo o alpha real da pessoa.
 */
@Injectable()
export class VideoMattingService {
  private readonly logger = new Logger(VideoMattingService.name);
  private readonly modelVersion: string;

  constructor(
    private readonly replicate: ReplicateClientService,
    private readonly config: ConfigService,
  ) {
    this.modelVersion = this.config.get<string>('generative.models.robustVideoMatting') ?? 'arielreplicate/robust_video_matting';
  }

  private tmp(ext: string) {
    return path.join(os.tmpdir(), `lucrom-m8-matte-${randomUUID()}.${ext}`);
  }

  /** Executa o RVM sobre o vídeo de entrada e retorna o caminho local do vídeo com fundo verde sintético. */
  async extractForeground(videoPath: string): Promise<string> {
    const buffer = await fs.readFile(videoPath);
    const dataUri = this.replicate.toDataUri(buffer, 'video/mp4');

    const output = await this.replicate.run(this.modelVersion, {
      input_video: dataUri,
      output_type: 'green-composite',
    });

    const outputUrl = typeof output === 'string' ? output : ((output as { video?: string })?.video ?? '');
    if (!outputUrl) {
      throw new Error(`Modelo de Video Matting (${this.modelVersion}) não retornou uma URL de vídeo válida.`);
    }

    const mattedBuffer = await this.replicate.downloadOutput(outputUrl);
    const mattedPath = this.tmp('mp4');
    await fs.writeFile(mattedPath, mattedBuffer);
    return mattedPath;
  }

  /**
   * Compõe o vídeo com fundo verde (saída do RVM) sobre uma imagem de fundo gerada
   * (Etapa 3), removendo o verde via `colorkey` (matting matemático por similaridade
   * de cor, com suavização de borda) e sobrepondo (`overlay`) na imagem de fundo,
   * esticada/cortada (`scale`+`crop`) para o mesmo tamanho do vídeo.
   */
  async compositeOverBackground(params: {
    foregroundGreenScreenPath: string;
    backgroundImagePath: string;
    outputWidth: number;
    outputHeight: number;
  }): Promise<string> {
    const outPath = this.tmp('mp4');
    const { foregroundGreenScreenPath, backgroundImagePath, outputWidth, outputHeight } = params;

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(backgroundImagePath)
        .loop()
        .input(foregroundGreenScreenPath)
        .complexFilter([
          `[0:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=increase,crop=${outputWidth}:${outputHeight}[bg]`,
          // colorkey: remove o verde sintético do RVM (0x00FF00), com tolerância e suavização de borda
          `[1:v]colorkey=0x00FF00:0.30:0.15,scale=${outputWidth}:${outputHeight}[fg]`,
          '[bg][fg]overlay=shortest=1[outv]',
        ])
        .outputOptions(['-map [outv]', '-map 1:a?', '-c:v libx264', '-preset medium', '-crf 20', '-c:a copy', '-shortest'])
        .output(outPath)
        .on('start', (cmd) => this.logger.debug(`ffmpeg matting composite: ${cmd}`))
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    return outPath;
  }

  async cleanup(...paths: (string | null | undefined)[]) {
    for (const p of paths) {
      if (p) await fs.rm(p, { force: true }).catch(() => undefined);
    }
  }
}
