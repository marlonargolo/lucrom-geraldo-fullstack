import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

export interface FrameStats {
  brightness: number; // 0..255
  contrast: number; // desvio-padrão da luminância, 0..~128
  saturation: number; // 0..1
  noise: number; // energia de alta frequência normalizada, 0..1
  palette: string[]; // até 5 cores hex dominantes
  /** % de pixels estourados nas sombras (luma < 8) — proxy de subexposição/corte de preto. */
  clippingShadows: number; // 0..1
  /** % de pixels estourados nas altas luzes (luma > 247) — proxy de superexposição. */
  clippingHighlights: number; // 0..1
  /** Nitidez: variância do Laplaciano (quanto maior, mais nítido). Não normalizado entre vídeos diferentes de propósito. */
  sharpness: number;
}

export interface FidelityReport {
  score: number; // 0..100
  hasReference: boolean;
  target: FrameStats;
  reference?: FrameStats;
  deltas?: { brightness: number; contrast: number; saturation: number; noise: number };
}

/**
 * Reimplementação server-side, com libvips (sharp) em vez de Canvas de navegador,
 * da mesma matemática usada em lib/measurement/fidelity.ts no frontend (versão B).
 * 100% determinístico: nenhum modelo generativo envolvido — apenas estatística de
 * imagem, exatamente o tipo de "infraestrutura verdadeira sem ser generativa"
 * pedida para este backend.
 */
@Injectable()
export class FidelityService {
  /** Extrai as métricas objetivas de um frame (Buffer de imagem: PNG/JPG). */
  async measureFrame(buffer: Buffer): Promise<FrameStats> {
    const { data, info } = await sharp(buffer)
      .resize(256, 256, { fit: 'fill' }) // normaliza custo computacional, mantém proporção estatística
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixelCount = info.width * info.height;
    let sumLuma = 0;
    let sumSat = 0;
    const lumas: number[] = new Array(pixelCount);
    const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();

    for (let i = 0, p = 0; i < data.length; i += info.channels, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Luminância perceptual (BT.601), igual ao usado no frontend.
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      lumas[p] = luma;
      sumLuma += luma;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      sumSat += sat;

      // Paleta: histograma quantizado em 32 níveis por canal (5 bits), igual ao frontend.
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.count++;
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }

    const brightness = sumLuma / pixelCount;
    const saturation = sumSat / pixelCount;

    let sumSqDiff = 0;
    for (const luma of lumas) sumSqDiff += (luma - brightness) ** 2;
    const contrast = Math.sqrt(sumSqDiff / pixelCount);

    // Ruído: energia média do gradiente entre pixels vizinhos horizontais (proxy de grain/flicker).
    let noiseAcc = 0;
    let noiseSamples = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 1; x < info.width; x++) {
        const idx = (y * info.width + x) * info.channels;
        const prevIdx = (y * info.width + (x - 1)) * info.channels;
        const diff = Math.abs(lumaAt(data, idx) - lumaAt(data, prevIdx));
        noiseAcc += diff;
        noiseSamples++;
      }
    }
    const noise = Math.min(1, noiseAcc / noiseSamples / 64);

    // Exposição: % de pixels estourados em sombra/luz (clipping) — checagem OBJETIVA e
    // ABSOLUTA (não depende de referência), atendendo à Camada 1 do documento de diretrizes.
    let shadowClip = 0;
    let highlightClip = 0;
    for (const luma of lumas) {
      if (luma < 8) shadowClip++;
      if (luma > 247) highlightClip++;
    }
    const clippingShadows = shadowClip / pixelCount;
    const clippingHighlights = highlightClip / pixelCount;

    // Nitidez: variância do Laplaciano (aproximação de segunda derivada 2D) — quanto maior,
    // mais nítida a imagem; próximo de zero indica desfoque/perda de detalhe.
    let sumLap = 0;
    let sumLapSq = 0;
    let lapSamples = 0;
    for (let y = 1; y < info.height - 1; y++) {
      for (let x = 1; x < info.width - 1; x++) {
        const c = lumas[y * info.width + x];
        const up = lumas[(y - 1) * info.width + x];
        const down = lumas[(y + 1) * info.width + x];
        const left = lumas[y * info.width + (x - 1)];
        const right = lumas[y * info.width + (x + 1)];
        const lap = up + down + left + right - 4 * c;
        sumLap += lap;
        sumLapSq += lap * lap;
        lapSamples++;
      }
    }
    const lapMean = sumLap / lapSamples;
    const sharpness = sumLapSq / lapSamples - lapMean * lapMean;

    const palette = Array.from(buckets.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ count, r, g, b }) => rgbToHex(Math.round(r / count), Math.round(g / count), Math.round(b / count)));

    return { brightness, contrast, saturation, noise, palette, clippingShadows, clippingHighlights, sharpness };
  }

  /**
   * Estabilização: mede o jitter médio entre frames amostrados ao longo do vídeo
   * (proxy de tremor de câmera/instabilidade — não é o mesmo que optical flow
   * profissional, mas é determinístico e barato o suficiente para rodar por job).
   */
  async measureStabilizationJitter(frameBuffers: Buffer[]): Promise<number> {
    if (frameBuffers.length < 2) return 0;

    const grayFrames: Buffer[] = [];
    for (const buf of frameBuffers) {
      const { data } = await sharp(buf).resize(128, 128, { fit: 'fill' }).grayscale().raw().toBuffer({ resolveWithObject: true });
      grayFrames.push(data);
    }

    let totalDiff = 0;
    for (let i = 1; i < grayFrames.length; i++) {
      let frameDiff = 0;
      for (let p = 0; p < grayFrames[i].length; p++) {
        frameDiff += Math.abs(grayFrames[i][p] - grayFrames[i - 1][p]);
      }
      totalDiff += frameDiff / grayFrames[i].length;
    }
    const avgDiff = totalDiff / (grayFrames.length - 1);
    return Math.min(1, avgDiff / 60); // normaliza para 0..1
  }

  /** Compara a peça gerada contra a referência do usuário (o "vídeo-molde") e calcula o score 0-100. */
  async compareToReference(targetBuffer: Buffer, referenceBuffer: Buffer | null): Promise<FidelityReport> {
    const target = await this.measureFrame(targetBuffer);
    if (!referenceBuffer) {
      return { score: 0, hasReference: false, target };
    }
    const reference = await this.measureFrame(referenceBuffer);

    const deltas = {
      brightness: Math.abs(target.brightness - reference.brightness) / 255,
      contrast: Math.abs(target.contrast - reference.contrast) / 128,
      saturation: Math.abs(target.saturation - reference.saturation),
      noise: Math.abs(target.noise - reference.noise),
    };

    // Peso maior em brilho/contraste (o que o olho humano nota primeiro), igual ao critério
    // de "fidelidade ≥99%" da Seção 2 do doc mestre.
    const weighted =
      deltas.brightness * 0.35 + deltas.contrast * 0.3 + deltas.saturation * 0.2 + deltas.noise * 0.15;
    const score = Math.max(0, Math.round((1 - weighted) * 100 * 100) / 100);

    return { score, hasReference: true, target, reference, deltas };
  }
}

function lumaAt(data: Buffer, idx: number): number {
  return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Color Matching (Seção 3 da mensagem do usuário — "Algoritmos que medem e
 * corrigem automaticamente curva de tom, temperatura e brilho para igualar
 * a uma peça de referência"). Traduz a diferença medida entre o frame gerado
 * e o frame de referência em parâmetros diretos do filtro `eq` do ffmpeg.
 * Puramente aritmético — sem IA.
 */
export function computeColorCorrection(
  target: FrameStats,
  reference: FrameStats,
): { brightness: number; contrast: number; saturation: number } {
  // eq=brightness aceita -1..1 (proporção de 255); aplicamos só metade da diferença
  // por passe para evitar overshoot perceptível (equivalente a um "ajuste suave").
  const brightnessDelta = (reference.brightness - target.brightness) / 255;
  const brightness = clampRange(brightnessDelta * 0.5, -0.3, 0.3);

  const contrastRatio = target.contrast > 0 ? reference.contrast / target.contrast : 1;
  const contrast = clampRange(1 + (contrastRatio - 1) * 0.5, 0.7, 1.4);

  const saturationRatio = target.saturation > 0 ? reference.saturation / target.saturation : 1;
  const saturation = clampRange(1 + (saturationRatio - 1) * 0.5, 0.5, 1.8);

  return { brightness, contrast, saturation };
}

function clampRange(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Padrão "profissional absoluto" usado quando NÃO há vídeo de referência —
 * exatamente o caso citado no documento de diretrizes ("mesmo partindo de
 * material simples"). Valores de referência de brilho/contraste/saturação
 * são os mesmos usados por padrão em correção de cor broadcast (luma médio
 * em torno de 118-128 em escala 0-255, ligeira saturação acima de neutro).
 */
const ABSOLUTE_TARGET = { brightness: 122, contrast: 52, saturation: 0.42 };

export function computeColorCorrectionAbsolute(target: FrameStats): { brightness: number; contrast: number; saturation: number } {
  const brightnessDelta = (ABSOLUTE_TARGET.brightness - target.brightness) / 255;
  const brightness = clampRange(brightnessDelta * 0.5, -0.25, 0.25);

  const contrastRatio = target.contrast > 0 ? ABSOLUTE_TARGET.contrast / target.contrast : 1;
  const contrast = clampRange(1 + (contrastRatio - 1) * 0.5, 0.8, 1.3);

  const saturationRatio = target.saturation > 0 ? ABSOLUTE_TARGET.saturation / target.saturation : 1;
  const saturation = clampRange(1 + (saturationRatio - 1) * 0.5, 0.7, 1.5);

  return { brightness, contrast, saturation };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}
