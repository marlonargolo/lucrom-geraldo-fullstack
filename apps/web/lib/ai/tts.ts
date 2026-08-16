// Locução real (M7) embutida no arquivo exportado.
// Diferente da Web Speech API (que só toca ao vivo e não é capturável pelo
// MediaRecorder), aqui baixamos o áudio de um TTS gratuito, decodificamos com
// Web Audio e mixamos numa faixa que ENTRA no MediaStream gravado.
//
// Fonte: text.pollinations.ai com model=openai-audio (grátis, sem chave).
// Se a rede falhar, retorna null e o render segue apenas com a trilha ambiente.

const TTS_ENDPOINT = "https://text.pollinations.ai"

/** Monta a URL do TTS gratuito para um trecho de texto. */
function ttsUrl(text: string, voice = "onyx"): string {
  const params = new URLSearchParams({ model: "openai-audio", voice })
  return `${TTS_ENDPOINT}/${encodeURIComponent(text)}?${params.toString()}`
}

/** Baixa e decodifica um trecho em AudioBuffer. Retorna null se falhar. */
async function fetchNarrationBuffer(
  ac: AudioContext,
  text: string,
  voice: string,
  signal?: AbortSignal,
): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(ttsUrl(text, voice), { signal })
    if (!res.ok) return null
    const type = res.headers.get("content-type") ?? ""
    if (!type.includes("audio") && !type.includes("mpeg")) return null
    const arr = await res.arrayBuffer()
    if (arr.byteLength < 1024) return null
    return await ac.decodeAudioData(arr)
  } catch {
    return null
  }
}

export interface NarrationSegment {
  /** Índice da cena a que o trecho pertence. */
  sceneIndex: number
  buffer: AudioBuffer
}

export interface NarrationTrack {
  /** Faixa de áudio pronta para entrar no MediaStream do MediaRecorder. */
  track: MediaStreamTrack
  /** Agenda a reprodução de cada trecho no tempo certo da linha do tempo. */
  start: (secondsPerScene: number) => void
  stop: () => void
  /** Quantos trechos de fato foram sintetizados. */
  count: number
}

/**
 * Sintetiza a narração de cada cena e devolve uma faixa mixável.
 * `onProgress(done, total)` reporta o download/decodificação.
 */
export async function buildNarrationTrack(
  ac: AudioContext,
  scenes: { title: string; body: string }[],
  opts: { voice?: string; signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<NarrationTrack | null> {
  const voice = opts.voice ?? "onyx"
  const total = scenes.length
  const segments: NarrationSegment[] = []

  for (let i = 0; i < scenes.length; i++) {
    if (opts.signal?.aborted) break
    const text = [scenes[i].title, scenes[i].body].filter(Boolean).join(". ").slice(0, 260)
    if (!text) {
      opts.onProgress?.(i + 1, total)
      continue
    }
    const buffer = await fetchNarrationBuffer(ac, text, voice, opts.signal)
    if (buffer) segments.push({ sceneIndex: i, buffer })
    opts.onProgress?.(i + 1, total)
  }

  if (segments.length === 0) return null

  const dest = ac.createMediaStreamDestination()
  const master = ac.createGain()
  master.gain.value = 1
  master.connect(dest)

  const sources: AudioBufferSourceNode[] = []

  const start = (secondsPerScene: number) => {
    const t0 = ac.currentTime + 0.08
    for (const seg of segments) {
      const src = ac.createBufferSource()
      src.buffer = seg.buffer
      src.connect(master)
      const when = t0 + seg.sceneIndex * secondsPerScene
      try {
        src.start(when)
      } catch {
        /* ignore */
      }
      sources.push(src)
    }
  }

  const stop = () => {
    for (const s of sources) {
      try {
        s.stop()
      } catch {
        /* ignore */
      }
    }
  }

  return { track: dest.stream.getAudioTracks()[0], start, stop, count: segments.length }
}
