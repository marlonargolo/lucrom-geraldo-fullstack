import { createRecorder, pickMimeType, roundRect } from "./media-engine"

export type EditorFilters = {
  brightness: number
  contrast: number
  saturate: number
}

export type TextPosition = "top" | "center" | "bottom"

export type EditorOverlay = {
  text: string
  position: TextPosition
  watermark: boolean
}

export function buildFilterString(f: EditorFilters): string {
  return `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturate})`
}

/** Grafo de áudio persistente por elemento (createMediaElementSource só pode rodar 1x). */
export type AudioGraph = { ac: AudioContext; dest: MediaStreamAudioDestinationNode }

export function ensureAudioGraph(video: HTMLVideoElement, cache: { current: AudioGraph | null }): AudioGraph {
  if (cache.current) return cache.current
  const AC = window.AudioContext || (window as any).webkitAudioContext
  const ac: AudioContext = new AC()
  const source = ac.createMediaElementSource(video)
  const dest = ac.createMediaStreamDestination()
  source.connect(dest)
  source.connect(ac.destination) // mantém o áudio audível na prévia
  cache.current = { ac, dest }
  return cache.current
}

function drawOverlays(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  overlay: EditorOverlay,
) {
  const scale = W / 1080

  if (overlay.text.trim()) {
    const fontSize = 52 * scale
    ctx.font = `700 ${fontSize}px "Space Grotesk", Inter, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const x = W / 2
    const y = overlay.position === "top" ? H * 0.12 : overlay.position === "center" ? H * 0.5 : H * 0.88

    const metrics = ctx.measureText(overlay.text)
    const boxW = Math.min(metrics.width + 48 * scale, W - 40 * scale)
    const boxH = fontSize + 32 * scale
    ctx.fillStyle = "rgba(0,0,0,0.55)"
    roundRect(ctx, x - boxW / 2, y - boxH / 2, boxW, boxH, 16 * scale)
    ctx.fill()

    ctx.fillStyle = "#ffffff"
    ctx.fillText(overlay.text, x, y, W - 80 * scale)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
  }

  if (overlay.watermark) {
    const fontSize = 28 * scale
    ctx.font = `700 ${fontSize}px "Space Grotesk", Inter, sans-serif`
    const label = "LUCROM Studio"
    const metrics = ctx.measureText(label)
    const padX = 20 * scale
    const boxW = metrics.width + padX * 2
    const boxH = fontSize + 20 * scale
    const x = W - boxW - 32 * scale
    const y = H - boxH - 32 * scale
    ctx.fillStyle = "rgba(0,0,0,0.5)"
    roundRect(ctx, x, y, boxW, boxH, 12 * scale)
    ctx.fill()
    ctx.fillStyle = "#f5b642"
    ctx.textBaseline = "middle"
    ctx.fillText(label, x + padX, y + boxH / 2)
    ctx.textBaseline = "alphabetic"
  }
}

export type ExportEditedOptions = {
  video: HTMLVideoElement
  inPoint: number
  outPoint: number
  filters: EditorFilters
  overlay: EditorOverlay
  audioCache: { current: AudioGraph | null }
  fps?: number
  onProgress?: (p: number) => void
  signal?: { cancelled: boolean }
}

/**
 * Reproduz o trecho [inPoint, outPoint] desenhando cada quadro (com filtros e
 * overlays) num canvas e gravando com o áudio original — gera um novo arquivo.
 */
export async function exportEditedVideo(
  opts: ExportEditedOptions,
): Promise<{ blob: Blob; mimeType: string }> {
  const { video, inPoint, outPoint, filters, overlay, audioCache } = opts
  const fps = opts.fps ?? 30

  const canvas = document.createElement("canvas")
  canvas.width = video.videoWidth || 1280
  canvas.height = video.videoHeight || 720
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D indisponível")

  const filterString = buildFilterString(filters)
  const mimeType = pickMimeType()
  const canvasStream = canvas.captureStream(fps)
  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()]

  // áudio original do vídeo
  let audio: AudioGraph | null = null
  try {
    audio = ensureAudioGraph(video, audioCache)
    if (audio.ac.state === "suspended") await audio.ac.resume()
    const audioTrack = audio.dest.stream.getAudioTracks()[0]
    if (audioTrack) tracks.push(audioTrack)
  } catch {
    // vídeo sem áudio ou navegador sem suporte — segue só com vídeo
  }

  const stream = new MediaStream(tracks)
  const { recorder, stopped } = createRecorder(stream, mimeType)

  // posiciona no início do corte
  video.pause()
  await seek(video, inPoint)

  const duration = Math.max(outPoint - inPoint, 0.1)

  recorder.start(100)
  await video.play()

  await new Promise<void>((resolve) => {
    const loop = () => {
      if (opts.signal?.cancelled) {
        resolve()
        return
      }
      const t = video.currentTime
      ctx.filter = filterString
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      ctx.filter = "none"
      drawOverlays(ctx, canvas.width, canvas.height, overlay)

      opts.onProgress?.(Math.min((t - inPoint) / duration, 1))

      if (t >= outPoint || video.ended) {
        resolve()
        return
      }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })

  video.pause()
  recorder.stop()
  const blob = await stopped
  return { blob, mimeType }
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked)
      resolve()
    }
    video.addEventListener("seeked", onSeeked)
    video.currentTime = Math.max(0, time)
  })
}
