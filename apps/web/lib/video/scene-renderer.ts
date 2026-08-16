import {
  createAmbientAudio,
  createRecorder,
  easeInOut,
  pickMimeType,
  roundRect,
  wrapText,
} from "./media-engine"
import {
  compareToReference,
  filterString,
  measureCanvas,
  measureImageSource,
  type FidelityReport,
} from "@/lib/measurement/fidelity"
import { buildNarrationTrack } from "@/lib/ai/tts"

export type Scene = {
  id: string
  kicker: string
  title: string
  body: string
  /** Descrição (em inglês) usada para gerar a imagem de fundo por IA. */
  imagePrompt?: string
  /** URL da imagem de fundo gerada por IA (Pollinations), quando houver. */
  backgroundUrl?: string
}

export type VideoTheme = {
  id: string
  label: string
  bg: string
  bgSoft: string
  fg: string
  muted: string
  accent: string
  accentFg: string
}

export const THEMES: VideoTheme[] = [
  {
    id: "midnight",
    label: "Midnight",
    bg: "#0b1120",
    bgSoft: "#111a2e",
    fg: "#f8fafc",
    muted: "#94a3b8",
    accent: "#f5b642",
    accentFg: "#1a1205",
  },
  {
    id: "ivory",
    label: "Ivory",
    bg: "#f7f5f0",
    bgSoft: "#efece3",
    fg: "#1a1a1a",
    muted: "#6b6b6b",
    accent: "#1a1a1a",
    accentFg: "#f7f5f0",
  },
  {
    id: "emerald",
    label: "Emerald",
    bg: "#04140f",
    bgSoft: "#0a2018",
    fg: "#ecfdf5",
    muted: "#6ee7b7",
    accent: "#34d399",
    accentFg: "#04140f",
  },
  {
    id: "royal",
    label: "Royal",
    bg: "#0a0f1f",
    bgSoft: "#121a33",
    fg: "#eef2ff",
    muted: "#a5b4fc",
    accent: "#60a5fa",
    accentFg: "#0a0f1f",
  },
]

export function themeById(id: string): VideoTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

/** Divide um texto livre em cenas coerentes (título + corpo). */
export function contentToScenes(raw: string): Scene[] {
  const text = raw.trim()
  if (!text) return []

  const blocks = text
    .split(/\n{2,}|\r\n\r\n/)
    .map((b) => b.trim())
    .filter(Boolean)

  const source =
    blocks.length > 1
      ? blocks
      : text
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter(Boolean)

  // Agrupa frases curtas para não gerar cenas excessivas
  const grouped: string[] = []
  let buffer = ""
  for (const part of source) {
    const candidate = buffer ? `${buffer} ${part}` : part
    if (candidate.length > 180 && buffer) {
      grouped.push(buffer)
      buffer = part
    } else {
      buffer = candidate
    }
  }
  if (buffer) grouped.push(buffer)

  const total = grouped.length
  return grouped.map((chunk, i) => {
    // primeira frase vira título, resto vira corpo
    const sentences = chunk.split(/(?<=[.!?])\s+/)
    const title = sentences[0]?.replace(/[.]$/, "") ?? chunk
    const body = sentences.slice(1).join(" ")
    return {
      id: `scene-${i}`,
      kicker: i === 0 ? "ABERTURA" : i === total - 1 ? "ENCERRAMENTO" : `CENA ${String(i + 1).padStart(2, "0")}`,
      title: title.slice(0, 120),
      body: body.slice(0, 220),
    }
  })
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) {
  const ir = img.width / img.height
  const cr = W / H
  let dw = W
  let dh = H
  if (ir > cr) {
    dh = H
    dw = H * ir
  } else {
    dw = W
    dh = W / ir
  }
  const dx = (W - dw) / 2
  const dy = (H - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  scene: Scene,
  localT: number,
  theme: VideoTheme,
  index: number,
  total: number,
  brandName: string,
  bgImage?: HTMLImageElement,
  grade?: string,
) {
  const scale = W / 1080
  const pad = 96 * scale

  // fundo
  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, W, H)

  if (bgImage) {
    // imagem gerada por IA com leve zoom (efeito Ken Burns) + overlay para legibilidade
    const zoom = 1.06 + 0.06 * easeInOut(localT)
    ctx.save()
    // color grade medido (M8): aplicado só ao plano de fundo, como um colorista.
    if (grade) ctx.filter = grade
    ctx.translate(W / 2, H / 2)
    ctx.scale(zoom, zoom)
    ctx.translate(-W / 2, -H / 2)
    drawImageCover(ctx, bgImage, W, H)
    ctx.restore()

    // véu escuro/claro conforme o tema para o texto respirar
    const isLight = theme.id === "ivory"
    const veil = ctx.createLinearGradient(0, 0, 0, H)
    if (isLight) {
      veil.addColorStop(0, "rgba(247,245,240,0.72)")
      veil.addColorStop(0.5, "rgba(247,245,240,0.55)")
      veil.addColorStop(1, "rgba(247,245,240,0.82)")
    } else {
      veil.addColorStop(0, "rgba(6,10,20,0.55)")
      veil.addColorStop(0.5, "rgba(6,10,20,0.42)")
      veil.addColorStop(1, "rgba(6,10,20,0.86)")
    }
    ctx.fillStyle = veil
    ctx.fillRect(0, 0, W, H)
  } else {
    // brilho suave no topo (sem imagem)
    ctx.save()
    if (grade) ctx.filter = grade
    const grad = ctx.createRadialGradient(W * 0.5, H * 0.15, 0, W * 0.5, H * 0.15, H * 0.9)
    grad.addColorStop(0, theme.bgSoft)
    grad.addColorStop(1, theme.bg)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
  }

  // animação de entrada/saída
  const intro = Math.min(localT / 0.14, 1)
  const outro = localT > 0.9 ? 1 - (localT - 0.9) / 0.1 : 1
  const appear = easeInOut(intro)
  const alpha = Math.max(0, Math.min(intro, outro))
  const slide = (1 - appear) * 40 * scale

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(0, slide)

  // barra de acento (kicker)
  const kickerY = pad
  ctx.fillStyle = theme.accent
  roundRect(ctx, pad, kickerY, 56 * scale, 8 * scale, 4 * scale)
  ctx.fill()

  ctx.fillStyle = theme.muted
  ctx.font = `600 ${26 * scale}px Inter, system-ui, sans-serif`
  ctx.textBaseline = "top"
  ctx.letterSpacing = `${4 * scale}px`
  ctx.fillText(scene.kicker, pad, kickerY + 22 * scale)
  ctx.letterSpacing = "0px"

  // título
  ctx.fillStyle = theme.fg
  const titleSize = (scene.title.length > 60 ? 62 : 78) * scale
  ctx.font = `700 ${titleSize}px "Space Grotesk", Inter, sans-serif`
  const titleLines = wrapText(ctx, scene.title, W - pad * 2)
  let ty = H * 0.32
  const titleLH = titleSize * 1.12
  for (const line of titleLines.slice(0, 5)) {
    ctx.fillText(line, pad, ty)
    ty += titleLH
  }

  // corpo
  if (scene.body) {
    ctx.fillStyle = theme.muted
    const bodySize = 34 * scale
    ctx.font = `400 ${bodySize}px Inter, system-ui, sans-serif`
    const bodyLines = wrapText(ctx, scene.body, W - pad * 2)
    let by = ty + 32 * scale
    const bodyLH = bodySize * 1.4
    for (const line of bodyLines.slice(0, 6)) {
      ctx.fillText(line, pad, by)
      by += bodyLH
    }
  }

  ctx.restore()

  // rodapé fixo: marca + progresso
  ctx.globalAlpha = 1
  ctx.fillStyle = theme.muted
  ctx.font = `600 ${24 * scale}px Inter, system-ui, sans-serif`
  ctx.textBaseline = "alphabetic"
  ctx.fillText(brandName, pad, H - pad + 8 * scale)

  // pontos de progresso
  const dotR = 6 * scale
  const gap = 26 * scale
  const totalW = total * gap
  let dx = W - pad - totalW + gap / 2
  const dy = H - pad + 2 * scale
  for (let i = 0; i < total; i++) {
    ctx.beginPath()
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2)
    ctx.fillStyle = i === index ? theme.accent : theme.muted + "55"
    ctx.fill()
    dx += gap
  }

  // barra de progresso da cena
  ctx.fillStyle = theme.accent
  const barW = (W - pad * 2) * localT
  roundRect(ctx, pad, H - pad + 26 * scale, barW, 5 * scale, 3 * scale)
  ctx.fill()
}

export type RenderOptions = {
  scenes: Scene[]
  theme: VideoTheme
  brandName: string
  secondsPerScene: number
  fps: number
  music: false | "calmo" | "energetico" | "corporativo"
  /** Imagem de referência (M8/M9): a peça é corrigida e medida contra ela. */
  reference?: HTMLImageElement | null
  /** Se true, sintetiza a locução e a EMBUTE no arquivo exportado. */
  narrate?: boolean
  /** Voz do TTS (default "onyx"). */
  voice?: string
  onProgress?: (p: number) => void
  /** Progresso da síntese de narração (download/decodificação). */
  onNarrationProgress?: (done: number, total: number) => void
  signal?: { cancelled: boolean }
}

export type RenderResult = {
  blob: Blob
  mimeType: string
  /** Medição objetiva final vs. referência (null se não houve referência). */
  measurement: FidelityReport | null
  /** Nº de trechos de narração de fato embutidos no arquivo. */
  narrationSegments: number
}

/**
 * Renderiza o vídeo em tempo real desenhando no canvas enquanto grava via
 * MediaRecorder. Se receber uma referência, mede a peça, calcula e aplica o
 * color grade para aproximar da referência (M8) e devolve a medição objetiva
 * final (M9). Se `narrate` estiver ligado, sintetiza a locução e a embute no
 * arquivo exportado.
 */
export async function renderScenesToVideo(
  canvas: HTMLCanvasElement,
  opts: RenderOptions,
): Promise<RenderResult> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas 2D indisponível")

  const { scenes, theme, brandName, secondsPerScene, fps, music, reference, narrate } = opts
  const W = canvas.width
  const H = canvas.height
  const totalMs = scenes.length * secondsPerScene * 1000

  // pré-carrega imagens de fundo (já são objectURLs canvas-safe) antes de gravar.
  // Cada imagem tem timeout próprio: se demorar, a cena apenas usa o fundo gradiente,
  // e o render NUNCA fica travado esperando a rede.
  const bgImages = new Map<string, HTMLImageElement>()
  await Promise.all(
    scenes
      .filter((s) => s.backgroundUrl)
      .map(
        (s) =>
          new Promise<void>((resolve) => {
            const img = new Image()
            let settled = false
            const done = () => {
              if (settled) return
              settled = true
              resolve()
            }
            const timer = setTimeout(done, 8000)
            img.onload = () => {
              if (!settled) bgImages.set(s.id, img)
              clearTimeout(timer)
              done()
            }
            img.onerror = () => {
              clearTimeout(timer)
              done()
            }
            img.src = s.backgroundUrl!
          }),
      ),
  )
  if (opts.signal?.cancelled) throw new Error("cancelado")

  // --- M9: mede a referência (se houver) ---
  const refMetrics = reference ? measureImageSource(reference) : null

  // --- M8: mede a peça sem grade e calcula a correção para bater a referência ---
  let grade: string | undefined
  if (refMetrics) {
    // desenha um quadro representativo sem grade e mede.
    drawScene(ctx, W, H, scenes[0], 0.5, theme, 0, scenes.length, brandName, bgImages.get(scenes[0].id))
    const rawMetrics = measureCanvas(canvas)
    if (rawMetrics) {
      const prelim = compareToReference(rawMetrics, refMetrics)
      grade = filterString(prelim.suggestion)
    }
  }

  const mimeType = pickMimeType()
  const canvasStream = canvas.captureStream(fps)

  let audioCtx: AudioContext | null = null
  let ambient: ReturnType<typeof createAmbientAudio> | null = null
  let narration: Awaited<ReturnType<typeof buildNarrationTrack>> = null
  const tracks = [...canvasStream.getVideoTracks()]

  if (music || narrate) {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    audioCtx = new AC()
    if (audioCtx.state === "suspended") await audioCtx.resume()
  }

  if (music && audioCtx) {
    ambient = createAmbientAudio(audioCtx, music)
    tracks.push(ambient.track)
  }

  // --- M7: sintetiza a locução e embute a faixa no arquivo gravado ---
  if (narrate && audioCtx) {
    narration = await buildNarrationTrack(audioCtx, scenes, {
      voice: opts.voice,
      onProgress: opts.onNarrationProgress,
    })
    if (narration) tracks.push(narration.track)
  }
  if (opts.signal?.cancelled) throw new Error("cancelado")

  const stream = new MediaStream(tracks)
  const { recorder, stopped } = createRecorder(stream, mimeType)

  // desenha primeiro quadro antes de gravar (já com grade aplicado)
  drawScene(ctx, W, H, scenes[0], 0, theme, 0, scenes.length, brandName, bgImages.get(scenes[0].id), grade)

  recorder.start(100)
  ambient?.start()
  narration?.start(secondsPerScene)
  const startTime = performance.now()

  await new Promise<void>((resolve) => {
    const loop = () => {
      const elapsed = performance.now() - startTime
      if (opts.signal?.cancelled) {
        resolve()
        return
      }
      const clamped = Math.min(elapsed, totalMs)
      const globalT = clamped / totalMs
      opts.onProgress?.(globalT)

      const sceneDurationMs = secondsPerScene * 1000
      let index = Math.floor(clamped / sceneDurationMs)
      if (index >= scenes.length) index = scenes.length - 1
      const localT = Math.min((clamped - index * sceneDurationMs) / sceneDurationMs, 1)

      drawScene(ctx, W, H, scenes[index], localT, theme, index, scenes.length, brandName, bgImages.get(scenes[index].id), grade)

      if (elapsed >= totalMs) {
        resolve()
        return
      }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })

  // --- M9: mede o quadro final (já graduado) e compara com a referência ---
  let measurement: FidelityReport | null = null
  if (refMetrics) {
    const finalMetrics = measureCanvas(canvas)
    if (finalMetrics) measurement = compareToReference(finalMetrics, refMetrics)
  }

  ambient?.stop()
  narration?.stop()
  recorder.stop()
  const blob = await stopped
  setTimeout(() => audioCtx?.close().catch(() => {}), 900)

  return { blob, mimeType, measurement, narrationSegments: narration?.count ?? 0 }
}
