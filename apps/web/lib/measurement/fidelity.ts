// Medição objetiva de fidelidade a partir de leitura real de pixels do canvas.
// Substitui qualquer "score" pseudoaleatório: aqui os números vêm de dados.
//
// Métricas por quadro:
// - luminância média (brilho, 0..1) — Rec. 709
// - desvio-padrão da luminância (contraste global, 0..1)
// - saturação média (0..1) no espaço HSV
// - estimativa de ruído (média do gradiente local absoluto, 0..1)
//
// Quando há uma imagem de referência, comparamos os dois conjuntos de métricas
// e derivamos uma nota 0..100 (quanto mais próximas as métricas, maior a nota).

export interface FrameMetrics {
  brightness: number
  contrast: number
  saturation: number
  noise: number
}

export interface FidelityReport {
  target: FrameMetrics
  reference: FrameMetrics | null
  /** Ajuste sugerido de filtro CSS/canvas para aproximar da referência. */
  suggestion: { brightness: number; contrast: number; saturate: number }
  /** Nota 0..100 derivada da distância entre métricas (100 = idêntico). */
  score: number
  /** True quando a nota veio de comparação com referência real. */
  hasReference: boolean
  measuredAt: number
}

/** Lê métricas de um ImageData (RGBA). */
export function metricsFromImageData(img: ImageData): FrameMetrics {
  const { data, width, height } = img
  const n = width * height
  let sumL = 0
  let sumL2 = 0
  let sumS = 0

  // luminância por pixel guardada para o cálculo de ruído (gradiente).
  const lum = new Float32Array(n)

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
    lum[p] = l
    sumL += l
    sumL2 += l * l

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const s = max <= 0 ? 0 : (max - min) / max
    sumS += s
  }

  const brightness = sumL / n
  const variance = Math.max(0, sumL2 / n - brightness * brightness)
  const contrast = Math.sqrt(variance) // desvio-padrão da luminância
  const saturation = sumS / n

  // ruído: média do |ΔL| horizontal e vertical (gradiente local).
  let gradSum = 0
  let gradCount = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (x + 1 < width) {
        gradSum += Math.abs(lum[p] - lum[p + 1])
        gradCount++
      }
      if (y + 1 < height) {
        gradSum += Math.abs(lum[p] - lum[p + width])
        gradCount++
      }
    }
  }
  const noise = gradCount ? gradSum / gradCount : 0

  return { brightness, contrast, saturation, noise }
}

/** Desenha uma fonte de imagem num canvas reduzido e lê as métricas. */
export function measureImageSource(
  source: CanvasImageSource,
  sampleW = 160,
  sampleH = 160,
): FrameMetrics | null {
  if (typeof document === "undefined") return null
  const c = document.createElement("canvas")
  c.width = sampleW
  c.height = sampleH
  const ctx = c.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, sampleW, sampleH)
  let img: ImageData
  try {
    img = ctx.getImageData(0, 0, sampleW, sampleH)
  } catch {
    // canvas "tainted" (imagem cross-origin sem CORS) — não dá para medir.
    return null
  }
  return metricsFromImageData(img)
}

/** Mede um canvas já desenhado (amostragem reduzida para custo baixo). */
export function measureCanvas(canvas: HTMLCanvasElement, sampleW = 160, sampleH = 160): FrameMetrics | null {
  return measureImageSource(canvas, sampleW, sampleH)
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * Compara métricas do alvo com a referência e produz relatório + sugestão de
 * filtro. A nota penaliza a distância relativa de cada métrica.
 */
export function compareToReference(target: FrameMetrics, reference: FrameMetrics | null): FidelityReport {
  const measuredAt = Date.now()

  if (!reference) {
    return {
      target,
      reference: null,
      suggestion: { brightness: 1, contrast: 1, saturate: 1 },
      score: 0,
      hasReference: false,
      measuredAt,
    }
  }

  // razões alvo→referência viram fatores de filtro (limitados para segurança).
  const brightnessFactor = clamp(reference.brightness / Math.max(target.brightness, 0.001), 0.6, 1.6)
  const contrastFactor = clamp(reference.contrast / Math.max(target.contrast, 0.001), 0.6, 1.6)
  const saturateFactor = clamp(reference.saturation / Math.max(target.saturation, 0.001), 0.6, 1.6)

  // nota: 1 - distância relativa média das quatro métricas.
  const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b, 0.001)
  const dist =
    (rel(target.brightness, reference.brightness) +
      rel(target.contrast, reference.contrast) +
      rel(target.saturation, reference.saturation) +
      rel(target.noise, reference.noise)) /
    4
  const score = Number((clamp(1 - dist, 0, 1) * 100).toFixed(1))

  return {
    target,
    reference,
    suggestion: {
      brightness: Number(brightnessFactor.toFixed(3)),
      contrast: Number(contrastFactor.toFixed(3)),
      saturate: Number(saturateFactor.toFixed(3)),
    },
    score,
    hasReference: true,
    measuredAt,
  }
}

/** Monta a string de filtro canvas/CSS a partir de uma sugestão. */
export function filterString(s: { brightness: number; contrast: number; saturate: number }): string {
  return `brightness(${s.brightness}) contrast(${s.contrast}) saturate(${s.saturate})`
}
