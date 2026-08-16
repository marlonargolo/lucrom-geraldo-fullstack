// IA gratuita e sem chave de API.
// - Imagens: https://image.pollinations.ai/prompt/{prompt}  (estável, CORS liberado)
// - Texto:   https://text.pollinations.ai/{prompt}          (requisições anônimas; pode falhar)
// Como o endpoint de texto é instável, há retentativas e um gerador local de
// reserva, garantindo que o roteiro sempre seja produzido — 100% grátis.

import type { Scene } from "@/lib/video/scene-renderer"

const TEXT_ENDPOINT = "https://text.pollinations.ai"
const IMAGE_ENDPOINT = "https://image.pollinations.ai/prompt"

/** Monta a URL de uma imagem gerada por IA para usar como fundo de cena. */
export function sceneImageUrl(prompt: string, w: number, h: number, seed: number): string {
  const styled = `${prompt}, cinematic lighting, high detail, photographic, no text, no watermark`
  const params = new URLSearchParams({
    width: String(w),
    height: String(h),
    seed: String(seed),
    nologo: "true",
    model: "flux",
  })
  return `${IMAGE_ENDPOINT}/${encodeURIComponent(styled)}?${params.toString()}`
}

/**
 * Baixa a imagem via fetch -> blob -> objectURL.
 * Isso evita "tainting" do canvas (que quebra o MediaRecorder na exportação)
 * e nos dá o status HTTP real (útil para detectar rate limit 429).
 * Retorna um objectURL pronto para virar <img>, ou null se falhar.
 * IMPORTANTE: chame URL.revokeObjectURL(url) quando não precisar mais.
 */
export async function fetchImageObjectUrl(
  url: string,
  timeoutMs = 45000,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const onAbort = () => ctrl.abort()
    signal?.addEventListener("abort", onAbort)
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) return null
      const blob = await res.blob()
      if (!blob.type.startsWith("image/")) return null
      return URL.createObjectURL(blob)
    } finally {
      clearTimeout(t)
      signal?.removeEventListener("abort", onAbort)
    }
  } catch {
    return null
  }
}

/** Cria um <img> a partir de um objectURL (canvas-safe, sem crossOrigin). */
export function loadImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Falha ao carregar imagem."))
    img.src = objectUrl
  })
}

/**
 * Gera imagens de fundo para uma lista de cenas de forma SEQUENCIAL e com pausa,
 * respeitando o rate limit do serviço gratuito. Retorna um mapa sceneId -> objectURL.
 * `onProgress` reporta (feitas, total). Cenas que falharem simplesmente não recebem imagem.
 */
export async function generateSceneBackgrounds(
  scenes: { id: string; imagePrompt?: string; title: string }[],
  w: number,
  h: number,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const total = scenes.length
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) break
    const scene = scenes[i]
    const prompt = (scene.imagePrompt || scene.title || "abstract background").slice(0, 160)
    const url = sceneImageUrl(prompt, w, h, 1000 + i * 7)
    const objectUrl = await fetchImageObjectUrl(url, 45000, signal)
    if (objectUrl) result.set(scene.id, objectUrl)
    onProgress?.(i + 1, total)
    // pausa curta entre chamadas para não estourar o rate limit anônimo
    if (i < total - 1) await new Promise((r) => setTimeout(r, 900))
  }
  return result
}

function timeout(ms: number, signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms)
    signal?.addEventListener("abort", () => {
      clearTimeout(t)
      reject(new Error("abort"))
    })
  })
}

/** Chama o endpoint de texto anônimo com retentativas curtas. Retorna null se falhar. */
async function callText(prompt: string, signal?: AbortSignal): Promise<string | null> {
  const url = `${TEXT_ENDPOINT}/${encodeURIComponent(prompt)}`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = (await Promise.race([
        fetch(url, { signal }),
        timeout(15000, signal),
      ])) as Response
      if (!res.ok) continue
      const text = (await res.text()).trim()
      // resposta de erro vem como JSON com "error"; ignoramos
      if (text.startsWith("{") && text.includes('"error"')) continue
      if (text.length > 0) return text
    } catch {
      /* tenta de novo */
    }
  }
  return null
}

/** Converte linhas "titulo | corpo" em cenas. Aceita variações comuns. */
function parseLines(text: string, topic: string): Scene[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]-?|[-*•])\s*/, "").trim())
    .filter((l) => l.length > 0 && !/^(cena|roteiro|t[íi]tulo)\b/i.test(l) === true ? l.length > 0 : true)
    .filter((l) => l.length > 2)

  const scenes: { title: string; body: string }[] = []
  for (const line of lines) {
    const [rawTitle, ...rest] = line.split(/\s*[|｜:–—-]\s*/)
    const title = (rawTitle ?? "").trim()
    if (!title) continue
    scenes.push({ title, body: rest.join(" ").trim() })
    if (scenes.length >= 8) break
  }
  return toScenes(scenes, topic)
}

function toScenes(items: { title: string; body: string }[], topic: string): Scene[] {
  const total = items.length
  return items.map((it, i) => ({
    id: `ai-scene-${Date.now()}-${i}`,
    kicker: i === 0 ? "ABERTURA" : i === total - 1 ? "ENCERRAMENTO" : `CENA ${String(i + 1).padStart(2, "0")}`,
    title: it.title.slice(0, 120),
    body: it.body.slice(0, 220),
    imagePrompt: `${it.title}. ${topic}`.slice(0, 160),
  }))
}

/** Gerador de reserva 100% local — nunca falha, sem rede. */
function localFallback(topic: string, count: number): Scene[] {
  const t = topic.trim().replace(/[.]+$/, "")
  const items = [
    { title: t, body: "O que ninguém te conta — e que muda tudo a partir de hoje." },
    { title: "O erro mais comum", body: `A maioria trava aqui quando o assunto é ${t.toLowerCase()}.` },
    { title: "O que realmente funciona", body: "Um passo simples, aplicável agora, sem enrolação." },
    { title: "Prova na prática", body: "Veja como pequenas mudanças geram grandes resultados." },
    { title: "Comece agora", body: "Salve este vídeo e dê o primeiro passo ainda hoje." },
  ].slice(0, Math.max(3, Math.min(count, 5)))
  return toScenes(items, t)
}

/**
 * Gera um roteiro de vídeo (cenas) a partir de um tema, usando IA gratuita.
 * Se a IA de texto estiver indisponível, cai em um gerador local para nunca falhar.
 * Retorna as cenas e uma flag indicando se veio da IA ou do reserva local.
 */
export async function generateScenesFromTopic(
  topic: string,
  count: number,
  signal?: AbortSignal,
): Promise<{ scenes: Scene[]; usedAI: boolean }> {
  const n = Math.max(3, Math.min(count, 6))
  // Prompt curto e simples — o endpoint anônimo responde melhor assim.
  const prompt =
    `Roteiro de vídeo curto em português brasileiro sobre "${topic}". ` +
    `Liste exatamente ${n} cenas, uma por linha, no formato: titulo curto de impacto | frase de apoio. ` +
    `Sem numerar, sem comentários.`

  const text = await callText(prompt, signal)
  if (text) {
    const scenes = parseLines(text, topic)
    if (scenes.length >= 3) return { scenes: scenes.slice(0, n), usedAI: true }
  }
  return { scenes: localFallback(topic, n), usedAI: false }
}
