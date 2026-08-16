import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { WordTimestamp } from './audio-clean.service';
import { SubtitleStyle } from './niche-preset.service';

/**
 * Etapa 4 da Especificação Técnica de Arquitetura — Motion & Legendas:
 * "Animação de texto em tempo real (word-level sync) e overlays de nomes/títulos."
 * Tecnologias: Remotion Engine / FFmpeg Filtergraph assíncrono.
 *
 * IMPLEMENTAÇÃO via FFmpeg drawtext:
 *   • Cada palavra recebe um segmento `drawtext` com `enable='between(t,start,end)'`
 *     — o texto aparece exatamente no intervalo de tempo retornado pelo WhisperX.
 *   • O nicho controla: fonte/tamanho, cor, destaque, posição vertical, caixa de fundo.
 *   • Palavras que excedem uma largura máxima são quebradas em múltiplas linhas (chunking).
 *   • Sem bibliotecas de Remotion — todo o pipeline é FFmpeg puro (determinístico, sem runtime JS).
 *
 * buildChunks() respeita pausas naturais na fala (gap > TIME_GAP_THRESHOLD_S
 * entre palavras força um novo chunk), além do limite por contagem de
 * palavras. O modo 'word-highlight' destaca cada palavra individualmente
 * enquanto exibe o chunk completo com as demais palavras na cor base —
 * o estilo "karaokê" usado em vídeos virais de UGC.
 */

export interface SubtitleChunk {
  text: string;
  start: number;
  end: number;
}

/**
 * Template visual de legenda:
 *   'standard'      — exibe o chunk inteiro de uma vez (comportamento original)
 *   'word-highlight' — exibe o chunk com a palavra atual destacada na highlightColor do nicho
 */
export type SubtitleTemplate = 'standard' | 'word-highlight';

const DEFAULT_STYLE: SubtitleStyle = {
  fontColor: '#FFFFFF',
  highlightColor: '#FFDD00',
  bgColor: '0x00000088',
  fontSize: 52,
  fontStyle: 'bold',
  position: 'bottom',
  borderRadius: 4,
  boxEnabled: true,
};

// Máximo de palavras por chunk de legenda (linha de texto)
const MAX_WORDS_PER_CHUNK = 5;

/**
 * Quebra de linha por tempo: se o intervalo entre o fim de uma palavra e o
 * início da próxima exceder este limiar, força um novo chunk independente
 * do contador de palavras — evita chunks que "atravessam" pausas naturais
 * (respiração, vírgula, mudança de tópico), sincronizando a legenda com o
 * ritmo real da fala.
 */
const TIME_GAP_THRESHOLD_S = 0.8;

/**
 * Resolução dinâmica do caminho da fonte:
 * tenta Liberation → DejaVu → FreeSans → fallback sem fonte (ffmpeg usa bitmap interno).
 */
function resolveFontPath(): string {
  const candidates = [
    // Debian/Ubuntu/Replit com fonts-liberation
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/liberation/LiberationSans-Bold.ttf',
    // NixOS
    '/run/current-system/sw/share/X11/fonts/LiberationSans-Bold.ttf',
    // DejaVu (fallback amplamente disponível)
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    // FreeSans
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
    // macOS (desenvolvimento local)
    '/Library/Fonts/Arial Bold.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
  ];

  for (const f of candidates) {
    if (existsSync(f)) {
      return f;
    }
  }

  // Retorna string vazia → ffmpeg usará o bitmap font embutido (sempre disponível)
  return '';
}

@Injectable()
export class MotionLegendsService {
  private readonly logger = new Logger(MotionLegendsService.name);
  private readonly fontPath: string;

  constructor() {
    this.fontPath = resolveFontPath();
    if (this.fontPath) {
      this.logger.log(`Fonte para legendas: ${this.fontPath}`);
    } else {
      this.logger.warn('Nenhuma fonte TTF encontrada — ffmpeg usará bitmap font embutido.');
    }
  }

  private tmp(ext: string) {
    return path.join(os.tmpdir(), `lucrom-m8-legends-${randomUUID()}.${ext}`);
  }

  /**
   * Queima legendas word-level sincronizadas no vídeo.
   *
   * @param videoPath       caminho local do vídeo de entrada
   * @param wordTimestamps  timestamps por palavra (saída do AudioCleanService)
   * @param style           estilo visual (do NichePresetService ou padrão)
   * @param template        template visual: 'standard' (padrão) ou 'word-highlight'
   * @returns               caminho local do vídeo com legendas
   */
  async renderSubtitles(params: {
    videoPath: string;
    wordTimestamps: WordTimestamp[];
    style?: Partial<SubtitleStyle>;
    template?: SubtitleTemplate;
  }): Promise<string> {
    const style: SubtitleStyle = { ...DEFAULT_STYLE, ...params.style };
    const { videoPath, wordTimestamps } = params;
    const template: SubtitleTemplate = params.template ?? 'standard';

    if (wordTimestamps.length === 0) {
      this.logger.warn('Nenhum timestamp de palavra disponível — legendas não serão geradas.');
      const copyPath = this.tmp('mp4');
      await fs.copyFile(videoPath, copyPath);
      return copyPath;
    }

    // Agrupa palavras em chunks respeitando contagem E pausas temporais
    const chunks = this.buildChunks(wordTimestamps);
    this.logger.log(
      `Renderizando ${chunks.length} chunks de legendas (word-level sync, template=${template})…`,
    );

    // Monta os filtros drawtext de acordo com o template selecionado
    const filters =
      template === 'word-highlight'
        ? this.buildWordHighlightFilters(chunks, wordTimestamps, style)
        : chunks.map((chunk) => this.buildDrawtextFilter(chunk, style));

    const outPath = this.tmp('mp4');

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .complexFilter(filters, 'v')
        .outputOptions([
          '-map [v]',
          '-map 0:a?',
          '-c:v libx264',
          '-preset medium',
          '-crf 20',
          '-c:a copy',
        ])
        .output(outPath)
        .on('start', (cmd) => this.logger.debug(`ffmpeg legends: ${cmd}`))
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    this.logger.log(`Legendas renderizadas: ${outPath}`);
    return outPath;
  }

  /**
   * Agrupa palavras consecutivas em chunks respeitando dois critérios:
   *   1. Máximo de MAX_WORDS_PER_CHUNK palavras por chunk.
   *   2. Pausa temporal > TIME_GAP_THRESHOLD_S entre palavras consecutivas
   *      força um novo chunk, independentemente da contagem — quebrando
   *      nos pontos naturais da fala.
   */
  private buildChunks(words: WordTimestamp[]): SubtitleChunk[] {
    const chunks: SubtitleChunk[] = [];
    let current: WordTimestamp[] = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const prev = current[current.length - 1];

      // Força novo chunk se: (a) atingiu limite de palavras, OU
      //                       (b) há pausa longa desde a palavra anterior
      const hasGap = prev != null && word.start - prev.end > TIME_GAP_THRESHOLD_S;
      const isFull = current.length >= MAX_WORDS_PER_CHUNK;

      if ((isFull || hasGap) && current.length > 0) {
        chunks.push({
          text: current.map((w) => w.word).join(' '),
          start: current[0].start,
          end: current[current.length - 1].end,
        });
        current = [];
      }

      current.push(word);
    }

    // Flush do último chunk
    if (current.length > 0) {
      chunks.push({
        text: current.map((w) => w.word).join(' '),
        start: current[0].start,
        end: current[current.length - 1].end,
      });
    }

    return chunks;
  }

  /**
   * Monta o filtro FFmpeg `drawtext` para um chunk de legenda (template 'standard').
   */
  private buildDrawtextFilter(chunk: SubtitleChunk, style: SubtitleStyle): string {
    const safeText = chunk.text.replace(/'/g, "\\'").replace(/:/g, '\\:');

    const fontColor = style.fontColor.replace('#', '0x');
    const yExpr =
      style.position === 'center'
        ? `(h/2-text_h/2)`
        : `(h*0.85-text_h)`;

    const boxParts: string[] = [];
    if (style.boxEnabled) {
      boxParts.push(`box=1:boxcolor=${style.bgColor}:boxborderw=${style.borderRadius + 8}`);
    }

    const parts = [
      `drawtext=text='${safeText}'`,
      ...(this.fontPath ? [`fontfile='${this.fontPath}'`] : []),
      `fontsize=${style.fontSize}`,
      `fontcolor=${fontColor}`,
      `x=(w-text_w)/2`,
      `y=${yExpr}`,
      `enable='between(t,${chunk.start.toFixed(3)},${chunk.end.toFixed(3)})'`,
      ...boxParts,
    ];

    return parts.join(':');
  }

  /**
   * Template 'word-highlight' (estilo karaokê/UGC).
   *
   * Gera dois filtros drawtext por palavra ativa:
   *   1. Texto completo do chunk na cor base (fontColor) — sempre visível durante o chunk.
   *   2. Apenas a palavra atual na highlightColor, posicionada por offset calculado —
   *      sobrepõe a palavra correspondente no texto base, criando o efeito de destaque.
   *
   * Limitação técnica do FFmpeg drawtext: não há suporte nativo a texto com estilos
   * inline (cores por trecho). A solução usada é sobrepor a palavra destacada por cima
   * do texto base usando `x` calculado por contagem de caracteres × largura estimada
   * por pixel (`fontsize * 0.55` é uma boa aproximação para fontes sans-serif).
   *
   * @param chunks         chunks já agrupados (com texto completo e intervalo de tempo)
   * @param wordTimestamps timestamps word-level originais (para janela de destaque)
   * @param style          estilo visual do nicho
   */
  private buildWordHighlightFilters(
    chunks: SubtitleChunk[],
    wordTimestamps: WordTimestamp[],
    style: SubtitleStyle,
  ): string[] {
    const filters: string[] = [];
    const fontColor = style.fontColor.replace('#', '0x');
    const highlightColor = style.highlightColor.replace('#', '0x');
    const yExpr = style.position === 'center' ? `(h/2-text_h/2)` : `(h*0.85-text_h)`;
    // Estimativa de largura de caractere em px para centralização do overlay de highlight
    const charWidthPx = style.fontSize * 0.55;

    for (const chunk of chunks) {
      const safeChunkText = chunk.text.replace(/'/g, "\\'").replace(/:/g, '\\:');

      // Camada 1: texto base do chunk inteiro (cor normal)
      const baseBoxParts: string[] = [];
      if (style.boxEnabled) {
        baseBoxParts.push(`box=1:boxcolor=${style.bgColor}:boxborderw=${style.borderRadius + 8}`);
      }
      const baseParts = [
        `drawtext=text='${safeChunkText}'`,
        ...(this.fontPath ? [`fontfile='${this.fontPath}'`] : []),
        `fontsize=${style.fontSize}`,
        `fontcolor=${fontColor}`,
        `x=(w-text_w)/2`,
        `y=${yExpr}`,
        `enable='between(t,${chunk.start.toFixed(3)},${chunk.end.toFixed(3)})'`,
        ...baseBoxParts,
      ];
      filters.push(baseParts.join(':'));

      // Camada 2: uma overlay por cada palavra do chunk, ativa apenas no intervalo da palavra
      const chunkWords = chunk.text.split(' ');
      // Calcula o offset de início de cada palavra dentro do texto completo do chunk
      let charOffset = 0;
      for (let wi = 0; wi < chunkWords.length; wi++) {
        const word = chunkWords[wi];

        // Encontra o WordTimestamp correspondente ao índice global desta palavra no chunk
        const globalWordIndex = wordTimestamps.findIndex(
          (wt) =>
            wt.word === word &&
            wt.start >= chunk.start &&
            wt.end <= chunk.end + 0.05,
        );

        if (globalWordIndex !== -1) {
          const wt = wordTimestamps[globalWordIndex];
          const safeWord = word.replace(/'/g, "\\'").replace(/:/g, '\\:');

          // Offset horizontal da palavra dentro do chunk:
          // (largura total do chunk) / 2 negada + offset acumulado de chars anteriores
          const chunkTotalChars = chunk.text.length;
          const xExpr =
            `(w/2 - ${Math.round(chunkTotalChars * charWidthPx * 0.5)} + ${Math.round(charOffset * charWidthPx)})`;

          const hlParts = [
            `drawtext=text='${safeWord}'`,
            ...(this.fontPath ? [`fontfile='${this.fontPath}'`] : []),
            `fontsize=${style.fontSize}`,
            `fontcolor=${highlightColor}`,
            `x=${xExpr}`,
            `y=${yExpr}`,
            `enable='between(t,${wt.start.toFixed(3)},${wt.end.toFixed(3)})'`,
          ];
          filters.push(hlParts.join(':'));
        }

        // Avança o offset: comprimento da palavra + espaço
        charOffset += word.length + 1;
      }
    }

    return filters;
  }

  /** Remove arquivos temporários gerados por este serviço. */
  async cleanup(...paths: (string | null | undefined)[]) {
    for (const p of paths) {
      if (p) await fs.rm(p, { force: true }).catch(() => undefined);
    }
  }
}
