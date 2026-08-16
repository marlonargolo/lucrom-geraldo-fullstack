// Camada de orquestração de provedores de IA para produção — FASE 2.
//
// Este arquivo NÃO substitui lib/ai/prompt-layer.ts, lib/ai/free-ai.ts nem
// lib/ai/tts.ts — ele os USA como último degrau de fallback. A ideia é:
//
//   texto:     Gemini Flash  -> DeepSeek       -> Pollinations (grátis) -> local
//   imagem:    FLUX.1/fal.ai -> Pollinations/FLUX (grátis)
//   narração:  Edge-TTS (grátis, sem chave)     -> Pollinations TTS (grátis)
//
// SEGURANÇA — leia antes de usar em produção:
// As chaves (GEMINI_API_KEY, DEEPSEEK_API_KEY, FAL_API_KEY) são lidas via
// `process.env` SEM prefixo NEXT_PUBLIC_ de propósito. Isso significa que,
// quando este módulo é importado por um Client Component (ex.: os
// componentes atuais em components/studio/*, que rodam no navegador), o
// Next.js NÃO injeta essas variáveis no bundle — elas chegam como
// `undefined` no browser. Na prática, isso é uma trava de segurança
// intencional: os provedores pagos só ativam quando este módulo roda em
// contexto server-side (Route Handler / Server Action / Server Component),
// nunca com a chave exposta no navegador. Se/quando você expuser essas
// funções pro frontend, faça isso por trás de uma API route própria
// (ex.: app/api/ai/generate-ad/route.ts) — nunca chamando os provedores
// pagos direto do client.
//
// Todas as funções aqui são "best-effort": se um provedor pago falhar (sem
// chave, erro de rede, resposta inválida), a cadeia cai automaticamente pro
// próximo estágio, terminando sempre num fallback 100% grátis/local que
// nunca falha — o MEI sempre recebe um resultado.

import {
  buildLayeredPrompt,
  parseAdPayload,
  generateAdPayload as generateAdPayloadFree,
  type MeiInput,
  type GeneratedAdPayload,
} from "@/lib/ai/prompt-layer"
import { sceneImageUrl } from "@/lib/ai/free-ai"

// ---------------------------------------------------------------------------
// Config — lida de process.env; nunca com prefixo NEXT_PUBLIC_ (ver aviso acima)
// ---------------------------------------------------------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ""
// Atualizado em ago/2026: "gemini-2.0-flash" foi desligado pela Google em
// 1º/jun/2026. "gemini-3.5-flash-lite" é o modelo GA mais barato da linha
// atual (3.x) — mesma filosofia de baixo custo do projeto. Se a Google
// aposentar esse também no futuro, troque só esta linha (ou defina
// GEMINI_MODEL no ambiente, sem precisar mexer no código).
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? ""
// Atualizado em ago/2026: "deepseek-chat" é um apelido legado que expira em
// 24/jul/2026 (já vencido) e passa a dar erro sem fallback depois disso.
// "deepseek-v4-flash" é o ID de modelo atual e permanente pra novas
// integrações — mesmo base_url, mesma chamada, só o nome mudou.
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"

// Reaproveita a convenção já usada no backend (apps/api/.env.example: FAL_API_KEY,
// "Fal.ai — alternativa ao Flux/Replicate para geração de fundos").
const FAL_API_KEY = process.env.FAL_API_KEY ?? ""
// "schnell" é a variante rápida/barata do FLUX.1 — a mais adequada pro caso
// de uso de baixo custo do MEI. Configurável, então dá pra trocar por outro
// modelo do fal.ai (incluindo um Z-Image, se/quando disponível no catálogo).
const FAL_IMAGE_MODEL = process.env.FAL_IMAGE_MODEL || "fal-ai/flux/schnell"

// Edge-TTS é a API de leitura em voz alta do Microsoft Edge — gratuita e sem
// chave. Roda apenas server-side (usa WebSocket nativo do Node); em ambiente
// de navegador, cai direto pro TTS grátis já existente em lib/ai/tts.ts.
const EDGE_TTS_DISABLED = process.env.DISABLE_EDGE_TTS === "true"

export type TextProvider = "gemini-flash" | "deepseek" | "pollinations-free" | "local"
export type ImageProvider = "flux-fal" | "pollinations-free"
export type NarrationProvider = "edge-tts" | "pollinations-free" | "none"

function timeout(ms: number, signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms)
    signal?.addEventListener("abort", () => {
      clearTimeout(t)
      reject(new Error("abort"))
    })
  })
}

// =============================================================================
// TEXTO — Gemini Flash -> DeepSeek -> Pollinations (grátis) -> local
// =============================================================================

async function callGeminiFlash(
  systemInstruction: string,
  userInstruction: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!GEMINI_API_KEY) return null
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
    const res = (await Promise.race([
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userInstruction }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 400 },
        }),
      }),
      timeout(15000, signal),
    ])) as Response
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return typeof text === "string" && text.length > 0 ? text : null
  } catch {
    return null
  }
}

async function callDeepSeek(
  systemInstruction: string,
  userInstruction: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!DEEPSEEK_API_KEY) return null
  try {
    const res = (await Promise.race([
      fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        signal,
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userInstruction },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 400,
        }),
      }),
      timeout(15000, signal),
    ])) as Response
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    return typeof text === "string" && text.length > 0 ? text : null
  } catch {
    return null
  }
}

/**
 * Gera o anúncio do MEI tentando, em ordem, os provedores pagos de baixo
 * custo configurados (Gemini Flash, depois DeepSeek) e caindo pro pipeline
 * grátis (Pollinations + fallback local, já validado na Fase 1) se nenhum
 * estiver configurado ou todos falharem. Nunca lança erro.
 */
export async function generateAdPayloadProduction(
  input: MeiInput,
  signal?: AbortSignal,
): Promise<{ payload: GeneratedAdPayload; provider: TextProvider; usedAI: boolean }> {
  const { systemInstruction, userInstruction } = buildLayeredPrompt(input)

  const gemini = await callGeminiFlash(systemInstruction, userInstruction, signal)
  const geminiParsed = gemini ? parseAdPayload(gemini) : null
  if (geminiParsed) return { payload: geminiParsed, provider: "gemini-flash", usedAI: true }

  const deepseek = await callDeepSeek(systemInstruction, userInstruction, signal)
  const deepseekParsed = deepseek ? parseAdPayload(deepseek) : null
  if (deepseekParsed) return { payload: deepseekParsed, provider: "deepseek", usedAI: true }

  // Reaproveita o pipeline grátis inteiro (Pollinations + fallback local) da Fase 1.
  const { payload, usedAI } = await generateAdPayloadFree(input, signal)
  return { payload, provider: usedAI ? "pollinations-free" : "local", usedAI }
}

// =============================================================================
// IMAGEM — FLUX.1 (fal.ai) -> Pollinations/FLUX (grátis, já existente)
// =============================================================================

/** Chama o FLUX.1 (variante "schnell", rápida/barata) via fal.ai. Retorna a URL da imagem gerada. */
async function callFalFlux(
  prompt: string,
  w: number,
  h: number,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!FAL_API_KEY) return null
  try {
    const res = (await Promise.race([
      fetch(`https://fal.run/${FAL_IMAGE_MODEL}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${FAL_API_KEY}`,
        },
        signal,
        body: JSON.stringify({
          prompt: `${prompt}, cinematic lighting, high detail, photographic, no text, no watermark`,
          image_size: { width: w, height: h },
          num_images: 1,
        }),
      }),
      timeout(30000, signal),
    ])) as Response
    if (!res.ok) return null
    const data = await res.json()
    const url = data?.images?.[0]?.url
    return typeof url === "string" && url.length > 0 ? url : null
  } catch {
    return null
  }
}

/**
 * Gera a URL de background de uma cena tentando FLUX.1 via fal.ai primeiro
 * (se FAL_API_KEY estiver configurada) e caindo pro FLUX grátis via
 * Pollinations (lib/ai/free-ai.ts, sem chave) em qualquer outro caso.
 * Retorna sempre uma URL utilizável (nunca null), pois o degrau final
 * (Pollinations) não depende de rede na hora de montar a URL.
 */
export async function generateSceneBackgroundProduction(
  prompt: string,
  w: number,
  h: number,
  seed: number,
  signal?: AbortSignal,
): Promise<{ url: string; provider: ImageProvider }> {
  const fal = await callFalFlux(prompt, w, h, signal)
  if (fal) return { url: fal, provider: "flux-fal" }

  return { url: sceneImageUrl(prompt, w, h, seed), provider: "pollinations-free" }
}

// =============================================================================
// NARRAÇÃO — Edge-TTS (grátis, sem chave, server-side) -> Pollinations TTS (grátis)
// =============================================================================

const EDGE_TTS_ENDPOINT =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1" +
  "?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4"

/** Vozes pt-BR comuns do Edge Read Aloud. */
export const EDGE_TTS_VOICES = {
  feminina: "pt-BR-FranciscaNeural",
  masculina: "pt-BR-AntonioNeural",
} as const

function escapeSsml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Sintetiza narração via Edge-TTS (protocolo WebSocket público do "Ler em
 * voz alta" do Microsoft Edge — gratuito, sem chave, mas NÃO documentado
 * oficialmente pela Microsoft; é o mesmo protocolo usado por bibliotecas
 * open-source como `edge-tts`). Roda apenas server-side (precisa de
 * WebSocket global do Node 22+) — em navegador, retorna null direto e o
 * chamador cai pro TTS grátis via Pollinations (lib/ai/tts.ts).
 *
 * AVISO: por depender de um endpoint não-oficial, o formato pode mudar sem
 * aviso da Microsoft. Por isso a cadeia de fallback é sempre a defesa
 * principal — nunca dependa só deste provedor.
 */
export async function synthesizeEdgeTts(
  text: string,
  voice: string = EDGE_TTS_VOICES.feminina,
  signal?: AbortSignal,
): Promise<ArrayBuffer | null> {
  if (EDGE_TTS_DISABLED) return null
  if (typeof window !== "undefined") return null // client-side: nunca tenta, cai pro fallback
  if (typeof WebSocket === "undefined") return null // Node sem WebSocket global (< v22)

  return new Promise((resolve) => {
    let settled = false
    const finish = (result: ArrayBuffer | null) => {
      if (settled) return
      settled = true
      try {
        ws.close()
      } catch {
        /* noop */
      }
      resolve(result)
    }

    const overallTimeout = setTimeout(() => finish(null), 20000)
    signal?.addEventListener("abort", () => finish(null))

    const chunks: Uint8Array[] = []
    let ws: WebSocket
    try {
      ws = new WebSocket(EDGE_TTS_ENDPOINT)
    } catch {
      clearTimeout(overallTimeout)
      resolve(null)
      return
    }

    ws.binaryType = "arraybuffer"

    ws.onopen = () => {
      const ts = new Date().toISOString()
      const configMsg =
        `X-Timestamp:${ts}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
                outputFormat: "audio-24khz-48kbitrate-mono-mp3",
              },
            },
          },
        })
      ws.send(configMsg)

      const requestId = crypto.randomUUID().replace(/-/g, "")
      const ssml =
        `<speak version='1.0' xml:lang='pt-BR'>` +
        `<voice name='${voice}'>${escapeSsml(text)}</voice>` +
        `</speak>`
      const ssmlMsg =
        `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${ts}\r\n` +
        `Path:ssml\r\n\r\n${ssml}`
      ws.send(ssmlMsg)
    }

    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === "string") {
        if (event.data.includes("Path:turn.end")) {
          clearTimeout(overallTimeout)
          if (chunks.length === 0) {
            finish(null)
            return
          }
          const total = chunks.reduce((sum, c) => sum + c.length, 0)
          const merged = new Uint8Array(total)
          let offset = 0
          for (const c of chunks) {
            merged.set(c, offset)
            offset += c.length
          }
          finish(merged.buffer)
        }
        return
      }
      // Mensagem binária: cabeçalho de texto + "Path:audio\r\n\r\n" + bytes de áudio (mp3).
      const buf = event.data instanceof ArrayBuffer ? event.data : null
      if (!buf) return
      const bytes = new Uint8Array(buf)
      const headerEnd = findHeaderEnd(bytes)
      if (headerEnd === -1) return
      const header = new TextDecoder().decode(bytes.slice(0, headerEnd))
      if (!header.includes("Path:audio")) return
      chunks.push(bytes.slice(headerEnd + 4))
    }

    ws.onerror = () => finish(null)
    ws.onclose = () => finish(chunks.length > 0 ? null : null)
  })
}

/** Acha o fim do cabeçalho de texto de uma mensagem binária do Edge-TTS (separador "\r\n\r\n"). */
function findHeaderEnd(bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length - 3; i++) {
    if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) {
      return i
    }
  }
  return -1
}

/** Baixa o áudio (mp3) do TTS grátis via Pollinations — mesmo endpoint usado em lib/ai/tts.ts. */
async function fetchPollinationsTtsAudio(
  text: string,
  voice = "onyx",
  signal?: AbortSignal,
): Promise<ArrayBuffer | null> {
  try {
    const url = `https://text.pollinations.ai/${encodeURIComponent(text)}?${new URLSearchParams({
      model: "openai-audio",
      voice,
    }).toString()}`
    const res = (await Promise.race([fetch(url, { signal }), timeout(20000, signal)])) as Response
    if (!res.ok) return null
    const type = res.headers.get("content-type") ?? ""
    if (!type.includes("audio") && !type.includes("mpeg")) return null
    const buf = await res.arrayBuffer()
    return buf.byteLength >= 1024 ? buf : null
  } catch {
    return null
  }
}

/**
 * Sintetiza a narração tentando Edge-TTS primeiro (server-side, grátis) e
 * caindo pro TTS grátis via Pollinations em qualquer outro caso (inclusive
 * quando chamado do navegador). Retorna os bytes MP3 crus — decodificação
 * em AudioBuffer/mixagem continua sendo responsabilidade de quem chama
 * (ver lib/ai/tts.ts::buildNarrationTrack para o caso de uso no navegador).
 */
export async function synthesizeNarrationProduction(
  text: string,
  opts: { voice?: string; signal?: AbortSignal } = {},
): Promise<{ audio: ArrayBuffer | null; provider: NarrationProvider }> {
  const edge = await synthesizeEdgeTts(text, opts.voice ?? EDGE_TTS_VOICES.feminina, opts.signal)
  if (edge) return { audio: edge, provider: "edge-tts" }

  const pollinations = await fetchPollinationsTtsAudio(text, "onyx", opts.signal)
  if (pollinations) return { audio: pollinations, provider: "pollinations-free" }

  return { audio: null, provider: "none" }
}

// =============================================================================
// Status dos provedores — útil para exibir badges na UI (ex.: audit-panel.tsx)
// =============================================================================
export interface AiServicesStatus {
  text: { geminiFlash: boolean; deepSeek: boolean; freeFallback: boolean }
  image: { fluxFal: boolean; freeFallback: boolean }
  narration: { edgeTts: boolean; freeFallback: boolean }
}

export function getAiServicesStatus(): AiServicesStatus {
  return {
    text: {
      geminiFlash: Boolean(GEMINI_API_KEY),
      deepSeek: Boolean(DEEPSEEK_API_KEY),
      freeFallback: true, // Pollinations + local — sempre disponível
    },
    image: {
      fluxFal: Boolean(FAL_API_KEY),
      freeFallback: true,
    },
    narration: {
      edgeTts: !EDGE_TTS_DISABLED && typeof window === "undefined",
      freeFallback: true,
    },
  }
}
