// Subcamada de Prompt Layering para anúncios de MEI.
//
// Objetivo: transformar 2-3 campos simples (tipo de negócio, oferta, tom) em
// um payload de anúncio pronto para vídeo — hook, corpo, CTA, prompt visual
// e texto de narração — usando UM ÚNICO system prompt compacto, economizando
// tokens em relação a chamadas soltas por campo.
//
// Este módulo é agnóstico de provedor: hoje ele chama o texto grátis já usado
// no projeto (text.pollinations.ai, ver lib/ai/free-ai.ts). Se/quando o
// projeto migrar para DeepSeek-V3, Gemini Flash ou outro provedor com chave,
// basta trocar a função `callTextProvider` — o restante do arquivo não muda.

import type { Scene } from "@/lib/video/scene-renderer"

export interface MeiInput {
  businessType: string
  offer: string
  tone?: string
}

export interface GeneratedAdPayload {
  hook: string
  body: string
  cta: string
  visualPrompt: string
  narrationText: string
}

/** Monta o system+user prompt compacto. Reaproveitável por qualquer provedor de texto. */
export function buildLayeredPrompt(input: MeiInput): {
  systemInstruction: string
  userInstruction: string
} {
  const tone = input.tone?.trim() || "direto e persuasivo"

  const systemInstruction =
    `Você é um copywriter especialista em anúncios curtos para MEI no Brasil. ` +
    `Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem texto fora do JSON, ` +
    `com exatamente as chaves: hook, body, cta, visualPrompt, narrationText. ` +
    `"hook" tem no máximo 12 palavras (impacto nos primeiros 3s). ` +
    `"body" tem no máximo 30 palavras (apresenta a oferta). ` +
    `"cta" tem no máximo 10 palavras e direciona para WhatsApp ou Instagram. ` +
    `"visualPrompt" é em INGLÊS, descreve um fundo/cena para gerar imagem via IA (FLUX.1/Z-Image), ` +
    `sem texto embutido na imagem. ` +
    `"narrationText" é o texto completo para virar áudio (TTS), em português, natural, até 30 segundos de fala. ` +
    `Mantenha o tom ${tone}.`

  const userInstruction = `Negócio: ${input.businessType}. Oferta: ${input.offer}.`

  return { systemInstruction, userInstruction }
}

/** Remove cercas de markdown (```json ... ```) que alguns modelos inserem mesmo quando instruídos a não fazer isso. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1].trim() : trimmed
}

/** Valida e normaliza o JSON retornado pelo modelo para o shape esperado. */
export function parseAdPayload(raw: string): GeneratedAdPayload | null {
  try {
    const clean = stripCodeFence(raw)
    const data = JSON.parse(clean)
    const hook = String(data.hook ?? "").trim()
    const body = String(data.body ?? "").trim()
    const cta = String(data.cta ?? "").trim()
    const visualPrompt = String(data.visualPrompt ?? data.visual_prompt ?? "").trim()
    const narrationText = String(data.narrationText ?? data.narration_text ?? "").trim()
    if (!hook || !body || !cta) return null
    return { hook, body, cta, visualPrompt, narrationText: narrationText || `${hook}. ${body}. ${cta}` }
  } catch {
    return null
  }
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

/**
 * Chamada real ao provedor de texto grátis do projeto (Pollinations, sem chave).
 * Isolada em função própria para facilitar troca futura por DeepSeek-V3/Gemini Flash
 * (bastaria implementar a mesma assinatura: (system, user, signal) => Promise<string|null>).
 */
async function callTextProvider(
  systemInstruction: string,
  userInstruction: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const prompt = `${systemInstruction}\n\n${userInstruction}`
  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?json=true`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = (await Promise.race([fetch(url, { signal }), timeout(15000, signal)])) as Response
      if (!res.ok) continue
      const text = (await res.text()).trim()
      if (text.length > 0) return text
    } catch {
      /* tenta de novo */
    }
  }
  return null
}

/** Fallback 100% local — nunca falha, sem rede. Garante que o MEI sempre recebe um anúncio. */
export function localAdFallback(input: MeiInput): GeneratedAdPayload {
  const hook = `${input.businessType}: essa oferta não vai durar!`
  const body = `${input.offer} — feito especialmente pra você, aproveite agora.`
  const cta = "Chama no WhatsApp e garanta o seu!"
  return {
    hook,
    body,
    cta,
    visualPrompt: `${input.businessType}, appetizing product shot, cinematic lighting, no text, no watermark`,
    narrationText: `${hook} ${body} ${cta}`,
  }
}

/**
 * Função principal: recebe a entrada simples do MEI e devolve o payload
 * estruturado do anúncio, chamando a IA e caindo em um reserva local se falhar.
 * Retorna também `usedAI` para o chamador poder sinalizar isso na UI.
 */
export async function generateAdPayload(
  input: MeiInput,
  signal?: AbortSignal,
): Promise<{ payload: GeneratedAdPayload; usedAI: boolean }> {
  const { systemInstruction, userInstruction } = buildLayeredPrompt(input)
  const raw = await callTextProvider(systemInstruction, userInstruction, signal)
  const parsed = raw ? parseAdPayload(raw) : null
  if (parsed) return { payload: parsed, usedAI: true }
  return { payload: localAdFallback(input), usedAI: false }
}

/** Converte o payload gerado em uma única Scene compatível com scene-renderer.ts. */
export function adPayloadToScene(payload: GeneratedAdPayload, id: string): Scene {
  return {
    id,
    kicker: "OFERTA",
    title: payload.hook.slice(0, 120),
    body: `${payload.body} ${payload.cta}`.slice(0, 220),
    imagePrompt: payload.visualPrompt.slice(0, 160),
  }
}

/**
 * Converte o payload gerado em 3 Scenes (gancho, oferta, chamada) compatíveis
 * com scene-renderer.ts/tts.ts, reaproveitando o MESMO visualPrompt nas três
 * para manter consistência visual do fundo ao longo do vídeo. Pensado para
 * alimentar diretamente o timeline do video-generator.tsx sem tocar no motor
 * de renderização (canvas + MediaRecorder).
 */
export function adPayloadToScenes(payload: GeneratedAdPayload, idPrefix: string): Scene[] {
  const imagePrompt = payload.visualPrompt.slice(0, 160)
  return [
    {
      id: `${idPrefix}-hook`,
      kicker: "GANCHO",
      title: payload.hook.slice(0, 120),
      body: "",
      imagePrompt,
    },
    {
      id: `${idPrefix}-oferta`,
      kicker: "OFERTA",
      title: payload.body.slice(0, 120),
      body: "",
      imagePrompt,
    },
    {
      id: `${idPrefix}-cta`,
      kicker: "CHAMADA",
      title: payload.cta.slice(0, 120),
      body: "",
      imagePrompt,
    },
  ]
}
