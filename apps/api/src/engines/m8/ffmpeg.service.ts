import { Injectable, Logger } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic as unknown as string);
if (ffprobeStatic?.path) ffmpeg.setFfprobePath(ffprobeStatic.path);

export interface ColorCorrection {
  /** Ajuste de brilho, -1..1 (equivalente ao filtro eq do ffmpeg). */
  brightness: number;
  /** Ajuste de contraste, tipicamente 0.5..2 (1 = neutro). */
  contrast: number;
  /** Ajuste de saturação, tipicamente 0..3 (1 = neutro). */
  saturation: number;
}

/**
 * Motor real de tratamento audiovisual (M8), implementado com ffmpeg —
 * processamento de sinal clássico e determinístico (denoise espaço-temporal,
 * correção de cor calculada a partir de medição real contra a referência,
 * normalização de loudness). NENHUMA parte disso é geração por IA.
 *
 * Explicitamente FORA de escopo aqui (por serem generativos): síntese de
 * avatar (M6), clonagem/síntese de voz (M7) e lip-sync (M8 generativo).
 */
@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);

  private tmpPath(ext: string): string {
    return path.join(os.tmpdir(), `lucrom-m8-${randomUUID()}.${ext}`);
  }

  async writeTemp(buffer: Buffer, ext: string): Promise<string> {
    const p = this.tmpPath(ext);
    await fs.writeFile(p, buffer);
    return p;
  }

  async readAndCleanup(p: string): Promise<Buffer> {
    const buf = await fs.readFile(p);
    await fs.rm(p, { force: true });
    return buf;
  }

  /** Extrai um frame (o do meio do vídeo) como PNG, usado para medição de fidelidade. */
  async extractMiddleFrame(videoPath: string): Promise<Buffer> {
    const duration = await this.probeDuration(videoPath);
    const at = Math.max(0, duration / 2);
    const outPath = this.tmpPath('png');
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(at)
        .frames(1)
        .output(outPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
    return this.readAndCleanup(outPath);
  }

  async probeDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, data) => {
        if (err) return reject(err);
        resolve(data.format.duration ?? 0);
      });
    });
  }

  /** Extrai N frames igualmente espaçados — usado para medir estabilização (jitter entre frames). */
  async extractSampledFrames(videoPath: string, count = 5): Promise<Buffer[]> {
    const duration = await this.probeDuration(videoPath);
    const buffers: Buffer[] = [];
    for (let i = 0; i < count; i++) {
      const at = (duration * (i + 1)) / (count + 1);
      const outPath = this.tmpPath('png');
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath).seekInput(at).frames(1).output(outPath).on('end', () => resolve()).on('error', reject).run();
      });
      buffers.push(await this.readAndCleanup(outPath));
    }
    return buffers;
  }

  /**
   * Mede loudness real do áudio SEM aplicar correção (dry-run do filtro loudnorm,
   * que no modo de análise devolve um JSON com input_i, input_tp, input_lra).
   * Isso é o "Diagnóstico" de áudio da Camada 1 — antes de decidir a normalização.
   */
  async analyzeAudioLoudness(inputPath: string): Promise<{ integratedLoudnessLufs: number; truePeakDb: number; loudnessRangeLu: number } | null> {
    return new Promise((resolve) => {
      let stderrBuf = '';
      ffmpeg(inputPath)
        .audioFilters('loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json')
        .format('null')
        .output('-')
        .on('stderr', (line: string) => {
          stderrBuf += line + '\n';
        })
        .on('end', () => resolve(parseLoudnormJson(stderrBuf)))
        .on('error', () => resolve(null)) // ex.: vídeo sem faixa de áudio — diagnóstico segue sem essa métrica
        .run();
    });
  }

  /**
   * Pipeline principal do M8: denoise (hqdn3d), correção de cor/relighting
   * (filtro eq com parâmetros calculados a partir da medição real contra a
   * referência) e normalização de áudio (loudnorm, padrão broadcast -16
   * LUFS). Roda tudo em um único passe do ffmpeg.
   *
   * `encodingPreset` controla o preset libx264: iterações intermediárias do
   * Quality Director usam 'ultrafast' (~70% mais rápido que 'medium', já
   * que o arquivo será re-encodado de qualquer forma na iteração seguinte);
   * apenas o passe final usa 'medium', garantindo qualidade de entrega.
   */
  async processVideo(params: {
    inputPath: string;
    denoise: { lumaSpatial: number; chromaSpatial: number; lumaTmp: number; chromaTmp: number } | null;
    colorCorrection: ColorCorrection | null;
    normalizeAudio: boolean;
    /** Preset libx264. 'ultrafast' para passes intermediários, 'medium' para o passe final (default). */
    encodingPreset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium';
  }): Promise<string> {
    const preset = params.encodingPreset ?? 'medium';
    const outputPath = this.tmpPath('mp4');
    const videoFilters: string[] = [];

    if (params.denoise) {
      // hqdn3d: denoise espaço-temporal, com força calculada pelo QualityDirectorService
      // a partir do ruído medido (não um preset fixo — atende ao pedido de correção
      // proporcional ao diagnóstico, e não "tamanho único").
      const d = params.denoise;
      videoFilters.push(`hqdn3d=${d.lumaSpatial.toFixed(2)}:${d.chromaSpatial.toFixed(2)}:${d.lumaTmp.toFixed(2)}:${d.chromaTmp.toFixed(2)}`);
    }
    if (params.colorCorrection) {
      const { brightness, contrast, saturation } = params.colorCorrection;
      videoFilters.push(`eq=brightness=${brightness.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}`);
    }

    const audioFilters: string[] = [];
    if (params.normalizeAudio) {
      // loudnorm: normalização de loudness padrão broadcast/comercial (EBU R128, -16 LUFS).
      audioFilters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
    }

    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(params.inputPath);
      if (videoFilters.length) cmd = cmd.videoFilters(videoFilters);
      if (audioFilters.length) cmd = cmd.audioFilters(audioFilters);
      cmd
        .outputOptions(['-c:v libx264', `-preset ${preset}`, '-crf 20', '-c:a aac', '-b:a 192k'])
        .output(outputPath)
        .on('start', (cmdline) => this.logger.debug(`ffmpeg [preset=${preset}]: ${cmdline}`))
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    return outputPath;
  }

  /**
   * Substitui a faixa de áudio do vídeo por um arquivo de áudio externo
   * (saída do DeepFilterNet). O vídeo original não é re-encodado.
   */
  async mergeAudioTrack(videoPath: string, audioPath: string): Promise<string> {
    const outputPath = this.tmpPath('mp4');
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          '-map 0:v',   // vídeo do arquivo original
          '-map 1:a',   // áudio do arquivo externo (limpo)
          '-c:v copy',
          '-c:a aac',
          '-b:a 192k',
          '-shortest',
        ])
        .output(outputPath)
        .on('start', (cmd) => this.logger.debug(`ffmpeg mergeAudio: ${cmd}`))
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
    return outputPath;
  }

  /**
   * Retorna as dimensões do primeiro stream de vídeo do arquivo.
   */
  async probeVideoDimensions(videoPath: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, data) => {
        if (err) return reject(err);
        const vs = data.streams.find((s) => s.codec_type === 'video');
        resolve({ width: vs?.width ?? 1080, height: vs?.height ?? 1920 });
      });
    });
  }

  /**
   * Mede o jitter médio de estabilização entre N frames amostrados,
   * usando diferença normalizada de luminância entre frames consecutivos.
   */
  async measureStabilizationJitter(frames: Buffer[]): Promise<number> {
    if (frames.length < 2) return 0;
    const sharp = await import('sharp');
    let totalDiff = 0;
    for (let i = 1; i < frames.length; i++) {
      const a = await sharp.default(frames[i - 1]).resize(64, 64).greyscale().raw().toBuffer();
      const b = await sharp.default(frames[i]).resize(64, 64).greyscale().raw().toBuffer();
      let diff = 0;
      for (let p = 0; p < a.length; p++) diff += Math.abs(a[p] - b[p]);
      totalDiff += diff / (a.length * 255);
    }
    return totalDiff / (frames.length - 1);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LACUNA 4 — Camadas de Motion Graphics (overlays, lower thirds, transições)
  //
  // Extensão aditiva ao FfmpegService original: nenhum método acima foi
  // alterado. Cobre o eixo "MOTION" e parte de "BRANDING_VISUAL", hoje
  // marcados como NÃO IMPLEMENTADO em quality-director.types.ts.
  //
  // Todos os métodos abaixo são FFmpeg puro (drawtext/drawbox/overlay/xfade),
  // no mesmo espírito determinístico do restante do serviço — nada generativo.
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Sobrepõe uma imagem (logo, selo, marca d'água) sobre o vídeo em uma
   * posição e janela de tempo definidas, com opacidade ajustável.
   *
   * @param inputPath     vídeo de entrada
   * @param overlayImagePath imagem PNG/JPG a sobrepor (idealmente PNG com alpha)
   * @param position      canto/posição da overlay na tela
   * @param opacity       0..1 (1 = totalmente opaco)
   * @param scaleWidth    largura em px para redimensionar a overlay antes de compor (opcional)
   * @param startTime     segundo de início da exibição (padrão: 0)
   * @param endTime       segundo de fim da exibição (padrão: duração toda do vídeo)
   */
  async overlayImage(params: {
    inputPath: string;
    overlayImagePath: string;
    position?: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'center';
    opacity?: number;
    scaleWidth?: number;
    startTime?: number;
    endTime?: number;
    margin?: number;
  }): Promise<string> {
    const {
      inputPath,
      overlayImagePath,
      position = 'top_right',
      opacity = 1,
      scaleWidth,
      startTime = 0,
      margin = 32,
    } = params;

    const outputPath = this.tmpPath('mp4');
    const positions: Record<string, string> = {
      top_left: `${margin}:${margin}`,
      top_right: `main_w-overlay_w-${margin}:${margin}`,
      bottom_left: `${margin}:main_h-overlay_h-${margin}`,
      bottom_right: `main_w-overlay_w-${margin}:main_h-overlay_h-${margin}`,
      center: `(main_w-overlay_w)/2:(main_h-overlay_h)/2`,
    };
    const xy = positions[position] ?? positions.top_right;

    let endTime = params.endTime;
    if (endTime == null) {
      endTime = await this.probeDuration(inputPath);
    }

    // Cadeia de filtros no overlay (input 1): redimensiona (se pedido) e aplica
    // opacidade via colorchannelmixer no canal alpha.
    const overlayFilterParts: string[] = [];
    if (scaleWidth) overlayFilterParts.push(`scale=${scaleWidth}:-1`);
    overlayFilterParts.push('format=rgba');
    if (opacity < 1) overlayFilterParts.push(`colorchannelmixer=aa=${opacity.toFixed(2)}`);

    const filterComplex = [
      `[1:v]${overlayFilterParts.join(',')}[ovl]`,
      `[0:v][ovl]overlay=${xy}:enable='between(t,${startTime.toFixed(3)},${endTime.toFixed(3)})'[v]`,
    ].join(';');

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(inputPath)
        .input(overlayImagePath)
        .complexFilter(filterComplex, 'v')
        .outputOptions(['-map [v]', '-map 0:a?', '-c:v libx264', '-preset medium', '-crf 20', '-c:a copy'])
        .output(outputPath)
        .on('start', (cmd) => this.logger.debug(`ffmpeg overlayImage: ${cmd}`))
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    return outputPath;
  }

  /**
   * Renderiza uma "lower third" (barra de identificação inferior, com título
   * e subtítulo opcional) — padrão de motion graphics para créditos de nome/
   * cargo, chamadas de produto/preço, etc.
   *
   * Implementado com drawbox (barra semitransparente) + drawtext (título em
   * destaque + subtítulo menor), ambos ativos apenas na janela `startTime..endTime`.
   */
  async renderLowerThird(params: {
    inputPath: string;
    title: string;
    subtitle?: string;
    startTime: number;
    endTime: number;
    accentColor?: string; // hex, cor de destaque da barra (padrão: marca do nicho, se não informado usa branco)
    textColor?: string;
  }): Promise<string> {
    const { inputPath, title, subtitle, startTime, endTime } = params;
    const accentColor = (params.accentColor ?? '#FFDD00').replace('#', '0x');
    const textColor = (params.textColor ?? '#FFFFFF').replace('#', '0x');
    const fontPath = resolveFontPathForMotionGraphics();

    const safeTitle = title.replace(/'/g, "\\'").replace(/:/g, '\\:');
    const safeSubtitle = (subtitle ?? '').replace(/'/g, "\\'").replace(/:/g, '\\:');
    const enable = `between(t,${startTime.toFixed(3)},${endTime.toFixed(3)})`;

    // Barra de destaque (fina, à esquerda do bloco de texto) + fundo semitransparente do bloco.
    const filters: string[] = [
      // Fundo do bloco (canto inferior esquerdo, ~38% da largura, altura proporcional ao texto)
      `drawbox=x=0:y=ih-ih*0.16:w=iw*0.42:h=ih*0.10:color=0x00000099:t=fill:enable='${enable}'`,
      // Barra de destaque vertical (identidade visual)
      `drawbox=x=0:y=ih-ih*0.16:w=8:h=ih*0.10:color=${accentColor}:t=fill:enable='${enable}'`,
      // Título
      [
        `drawtext=text='${safeTitle}'`,
        ...(fontPath ? [`fontfile='${fontPath}'`] : []),
        `fontsize=38`,
        `fontcolor=${textColor}`,
        `x=iw*0.03`,
        `y=ih-ih*0.16+ih*0.018`,
        `enable='${enable}'`,
      ].join(':'),
    ];

    if (safeSubtitle) {
      filters.push(
        [
          `drawtext=text='${safeSubtitle}'`,
          ...(fontPath ? [`fontfile='${fontPath}'`] : []),
          `fontsize=24`,
          `fontcolor=${textColor}`,
          `alpha=0.85`,
          `x=iw*0.03`,
          `y=ih-ih*0.16+ih*0.058`,
          `enable='${enable}'`,
        ].join(':'),
      );
    }

    const outputPath = this.tmpPath('mp4');
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(filters, 'v')
        .outputOptions(['-map [v]', '-map 0:a?', '-c:v libx264', '-preset medium', '-crf 20', '-c:a copy'])
        .output(outputPath)
        .on('start', (cmd) => this.logger.debug(`ffmpeg renderLowerThird: ${cmd}`))
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    return outputPath;
  }

  /**
   * Concatena dois clipes com uma transição de motion graphics entre eles
   * (fade, wipe, slide, etc.) via filtro `xfade` (vídeo) + `acrossfade` (áudio).
   *
   * @param firstClipPath   primeiro clipe (a transição começa perto do seu fim)
   * @param secondClipPath  segundo clipe (a transição termina perto do seu início)
   * @param transition      tipo de transição (nomes nativos do filtro xfade do FFmpeg)
   * @param durationSeconds duração da transição em segundos (padrão: 1s)
   */
  async applyTransition(params: {
    firstClipPath: string;
    secondClipPath: string;
    transition?: 'fade' | 'wipeleft' | 'wiperight' | 'slideup' | 'slidedown' | 'circleopen' | 'circleclose' | 'dissolve';
    durationSeconds?: number;
  }): Promise<string> {
    const { firstClipPath, secondClipPath, transition = 'fade', durationSeconds = 1 } = params;

    const firstDuration = await this.probeDuration(firstClipPath);
    // xfade precisa do "offset": instante (relativo ao primeiro clipe) em que a transição começa.
    const offset = Math.max(0, firstDuration - durationSeconds);

    const outputPath = this.tmpPath('mp4');
    const filterComplex = [
      `[0:v][1:v]xfade=transition=${transition}:duration=${durationSeconds.toFixed(2)}:offset=${offset.toFixed(2)}[v]`,
      `[0:a][1:a]acrossfade=d=${durationSeconds.toFixed(2)}[a]`,
    ].join(';');

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(firstClipPath)
        .input(secondClipPath)
        .complexFilter(filterComplex, ['v', 'a'])
        .outputOptions(['-map [v]', '-map [a]', '-c:v libx264', '-preset medium', '-crf 20', '-c:a aac', '-b:a 192k'])
        .output(outputPath)
        .on('start', (cmd) => this.logger.debug(`ffmpeg applyTransition: ${cmd}`))
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    return outputPath;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Processamento Assíncrono com FFmpeg — pós-processamento de vídeos
  // gerados por IA (video-render.worker.ts). Extensão aditiva, mesma
  // convenção da seção de Motion Graphics acima.
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Redimensiona e enquadra um vídeo para um aspect ratio alvo, preenchendo
   * toda a moldura (scale + crop central) — sem barras pretas, sem distorção.
   * Usado pelo `video-render.worker.ts` para adaptar a saída bruta da IA
   * (Fal.ai/Replicate) ao formato pedido no briefing (9:16, 16:9 ou 1:1).
   */
  async cropToAspectRatio(params: { inputPath: string; aspectRatio: '9:16' | '16:9' | '1:1' | '4:5' }): Promise<string> {
    const { inputPath, aspectRatio } = params;

    // Resolução de saída padrão por formato (mesmas dimensões usadas pelo
    // GraphicComposerService para peças estáticas, por consistência de marca).
    // '4:5' (1080x1350) é o formato de feed retrato do Instagram.
    const dimensions: Record<'9:16' | '16:9' | '1:1' | '4:5', [number, number]> = {
      '9:16': [1080, 1920],
      '16:9': [1920, 1080],
      '1:1': [1080, 1080],
      '4:5': [1080, 1350],
    };
    const [width, height] = dimensions[aspectRatio];

    const outputPath = this.tmpPath('mp4');
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters([`scale=${width}:${height}:force_original_aspect_ratio=increase`, `crop=${width}:${height}`])
        .outputOptions(['-c:v libx264', '-preset medium', '-crf 20', '-c:a aac', '-b:a 192k', '-movflags +faststart'])
        .output(outputPath)
        .on('start', (cmd) => this.logger.debug(`ffmpeg cropToAspectRatio: ${cmd}`))
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    return outputPath;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Edição pós-geração (engines/m8/edit) — corte de um vídeo já renderizado.
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Corta um vídeo entre `startTime` e `endTime` (segundos).
   *
   * Tenta primeiro `-c copy` (stream copy, sem reencode — instantâneo, mas só
   * corta em keyframes, então o corte pode ficar levemente impreciso). Se o
   * resultado sair vazio/corrompido (raro, mas acontece perto do fim do vídeo
   * ou em containers sem keyframes bem distribuídos), refaz com reencode
   * (`-c:v libx264`), que é preciso a nível de frame.
   */
  async trim(params: { inputPath: string; startTime: number; endTime: number }): Promise<string> {
    const { inputPath, startTime, endTime } = params;
    if (endTime <= startTime) {
      throw new Error(`endTime (${endTime}) precisa ser maior que startTime (${startTime}).`);
    }
    const duration = endTime - startTime;

    const tryStreamCopy = async (): Promise<string> => {
      const outputPath = this.tmpPath('mp4');
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(startTime)
          .setDuration(duration)
          .outputOptions(['-c copy', '-avoid_negative_ts make_zero', '-movflags +faststart'])
          .output(outputPath)
          .on('start', (cmd) => this.logger.debug(`ffmpeg trim [stream copy]: ${cmd}`))
          .on('end', () => resolve())
          .on('error', reject)
          .run();
      });
      return outputPath;
    };

    const reencode = async (): Promise<string> => {
      const outputPath = this.tmpPath('mp4');
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(startTime)
          .setDuration(duration)
          .outputOptions(['-c:v libx264', '-preset medium', '-crf 20', '-c:a aac', '-b:a 192k', '-movflags +faststart'])
          .output(outputPath)
          .on('start', (cmd) => this.logger.debug(`ffmpeg trim [reencode]: ${cmd}`))
          .on('end', () => resolve())
          .on('error', reject)
          .run();
      });
      return outputPath;
    };

    try {
      const outputPath = await tryStreamCopy();
      const stat = await fs.stat(outputPath).catch(() => null);
      if (stat && stat.size > 0) {
        return outputPath;
      }
      await fs.rm(outputPath, { force: true });
      this.logger.warn('trim(): stream copy produziu arquivo vazio, refazendo com reencode.');
      return await reencode();
    } catch (err) {
      this.logger.warn(`trim(): stream copy falhou (${(err as Error).message}), refazendo com reencode.`);
      return await reencode();
    }
  }
}

/**
 * Resolução de fonte para os filtros de Motion Graphics (lower thirds).
 * Duplicado deliberadamente de forma independente da resolveFontPath() usada
 * em motion-legends.service.ts — evita acoplar os dois serviços a uma função
 * compartilhada só por causa de um detalhe de fallback de fonte.
 */
function resolveFontPathForMotionGraphics(): string {
  const candidates = [
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/Library/Fonts/Arial Bold.ttf',
  ];
  for (const f of candidates) {
    if (existsSync(f)) return f;
  }
  return '';
}

function parseLoudnormJson(stderr: string): { integratedLoudnessLufs: number; truePeakDb: number; loudnessRangeLu: number } | null {
  const match = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return {
      integratedLoudnessLufs: parseFloat(parsed.input_i),
      truePeakDb: parseFloat(parsed.input_tp),
      loudnessRangeLu: parseFloat(parsed.input_lra),
    };
  } catch {
    return null;
  }
}
