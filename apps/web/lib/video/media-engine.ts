// Motor de mídia local — sem APIs de terceiros.
// Usa apenas Canvas 2D, MediaRecorder, canvas.captureStream e Web Audio.

export type AspectId = "9:16" | "1:1" | "16:9"

export const ASPECTS: { id: AspectId; label: string; w: number; h: number }[] = [
  { id: "9:16", label: "Vertical · Reels/Stories", w: 1080, h: 1920 },
  { id: "1:1", label: "Quadrado · Feed", w: 1080, h: 1080 },
  { id: "16:9", label: "Horizontal · YouTube", w: 1920, h: 1080 },
]

export function aspectDims(id: AspectId) {
  return ASPECTS.find((a) => a.id === id) ?? ASPECTS[0]
}

/** Escolhe o melhor container/codec suportado pelo navegador. */
export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return ""
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ]
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c
    } catch {
      /* ignore */
    }
  }
  return ""
}

export function extForMime(mime: string): string {
  if (mime.includes("mp4")) return "mp4"
  return "webm"
}

/** Faz download de um Blob no navegador. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.floor((seconds - Math.floor(seconds)) * 10)
  return `${m}:${s.toString().padStart(2, "0")}.${cs}`
}

/**
 * Grava um MediaStream via MediaRecorder e resolve com o Blob final.
 * O chamador controla o loop de desenho; aqui só cuidamos do recorder.
 */
export function createRecorder(stream: MediaStream, mimeType: string) {
  const chunks: BlobPart[] = []
  const options = mimeType ? { mimeType } : undefined
  const recorder = new MediaRecorder(stream, options)
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const type = mimeType || "video/webm"
      resolve(new Blob(chunks, { type }))
    }
  })
  return { recorder, stopped }
}

/** Quebra texto em linhas que cabem em maxWidth (medindo no contexto do canvas). */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Curva de easing suave (easeInOutCubic). */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Retângulo com cantos arredondados (fallback caso roundRect não exista). */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, radius)
    return
  }
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/**
 * Cria uma trilha sonora ambiente sintetizada (Web Audio) e devolve a faixa de
 * áudio para combinar no MediaRecorder. Totalmente local — sem arquivos externos.
 */
export function createAmbientAudio(ac: AudioContext, mood: "calmo" | "energetico" | "corporativo") {
  const dest = ac.createMediaStreamDestination()
  const master = ac.createGain()
  master.gain.value = 0.0001
  master.connect(dest)

  const presets = {
    calmo: { base: 174.61, chord: [1, 1.5, 2], gain: 0.18, lfo: 0.08 },
    energetico: { base: 220, chord: [1, 1.25, 1.5, 2], gain: 0.14, lfo: 0.5 },
    corporativo: { base: 196, chord: [1, 1.5, 2.5], gain: 0.16, lfo: 0.12 },
  } as const
  const p = presets[mood]

  const oscillators: OscillatorNode[] = []
  p.chord.forEach((mult, i) => {
    const osc = ac.createOscillator()
    osc.type = i === 0 ? "sine" : "triangle"
    osc.frequency.value = p.base * mult
    const g = ac.createGain()
    g.gain.value = p.gain / p.chord.length
    osc.connect(g)
    g.connect(master)
    oscillators.push(osc)
  })

  // LFO para dar movimento suave ao volume
  const lfo = ac.createOscillator()
  lfo.frequency.value = p.lfo
  const lfoGain = ac.createGain()
  lfoGain.gain.value = 0.06
  lfo.connect(lfoGain)
  lfoGain.connect(master.gain)

  const start = () => {
    const now = ac.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(0.6, now + 1.2)
    oscillators.forEach((o) => o.start())
    lfo.start()
  }
  const stop = () => {
    const now = ac.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)
    setTimeout(() => {
      oscillators.forEach((o) => {
        try {
          o.stop()
        } catch {
          /* ignore */
        }
      })
      try {
        lfo.stop()
      } catch {
        /* ignore */
      }
    }, 700)
  }

  return { track: dest.stream.getAudioTracks()[0], start, stop }
}
