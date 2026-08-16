// Helper client-side para os componentes em components/studio/* consumirem
// os provedores de produção (Gemini Flash/DeepSeek/FLUX/Edge-TTS) SEM nunca
// tocar em chaves pagas no navegador — toda chamada passa pela Route Handler
// server-side em app/api/ai/generate-ad/route.ts, que por sua vez usa
// lib/ai-services.ts.
//
// AUTENTICAÇÃO: a rota exige `X-User-Token` (ver lib/auth/require-user.ts).
// Este helper anexa o token da sessão ativa (lib/auth/session-store.ts) e,
// sem sessão, nem chega a chamar a rota — lança um erro claro pedindo login.
// Isso é intencional: sem essa checagem aqui, um usuário deslogado ainda
// conseguiria gerar anúncios via fallback client-side, o que anularia a
// proteção adicionada na rota (o objetivo é login virar um gate real pro
// recurso pago, não só a rota /api/ai/generate-ad sozinha).
//
// Defesa em profundidade que PERMANECE: se a rota falhar por motivo de
// INFRAESTRUTURA (servidor fora do ar, erro de rede, 5xx) — não de
// autenticação nem de cota — este helper ainda cai pro pipeline 100%
// client-side grátis/local da Fase 1 (lib/ai/prompt-layer.ts), pra um
// problema no servidor não travar a produção de quem já está logado.
//
// 402 (cota mensal do plano esgotada) é tratado à parte, sem cair no
// fallback: é uma regra de negócio, não uma falha — cair pro fallback
// grátis nesse caso anularia o controle de cota inteiro.

import { generateAdPayload as generateAdPayloadFree, type MeiInput, type GeneratedAdPayload } from "./prompt-layer"
import { getSession, clearSession } from "@/lib/auth/session-store"
import { QuotaExceededError } from "@/lib/billing/quota-error"

export type AdTextProvider = "gemini-flash" | "deepseek" | "pollinations-free" | "local"

export interface GenerateAdResult {
  payload: GeneratedAdPayload
  provider: AdTextProvider
  usedAI: boolean
}

async function freeFallback(input: MeiInput, signal?: AbortSignal): Promise<GenerateAdResult> {
  const { payload, usedAI } = await generateAdPayloadFree(input, signal)
  return { payload, provider: usedAI ? "pollinations-free" : "local", usedAI }
}

/**
 * Gera o anúncio do MEI chamando a API route server-side (que orquestra
 * Gemini Flash -> DeepSeek -> Pollinations -> local via lib/ai-services.ts).
 *
 * - Sem sessão ativa: lança erro pedindo login (não tenta nem a rota).
 * - Rota responde 401 (token expirado/inválido no servidor): limpa a sessão
 *   local e lança erro pedindo novo login.
 * - Rota responde 402 (cota mensal do plano esgotada): lança erro orientando
 *   upgrade — não cai pro fallback grátis (isso seria burlar o limite).
 * - Rota fora do ar / erro de rede / 5xx: cai pro pipeline client-side
 *   grátis/local (resiliência de infraestrutura, não brecha de auth/cota).
 */
export async function generateAdViaApi(input: MeiInput, signal?: AbortSignal): Promise<GenerateAdResult> {
  const session = getSession()
  if (!session) {
    throw new Error("Faça login para gerar anúncios com IA — é um recurso pago, disponível só pra contas autenticadas.")
  }

  let res: Response
  try {
    res = await fetch("/api/ai/generate-ad", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Token": session.accessToken },
      body: JSON.stringify(input),
      signal,
    })
  } catch {
    // Falha de rede local (não é problema de autenticação) — resiliência de infra.
    return freeFallback(input, signal)
  }

  if (res.status === 401) {
    clearSession() // token não é mais válido no servidor; limpa localmente pra UI voltar a mostrar "Entrar"
    throw new Error("Sessão expirada. Faça login novamente para continuar gerando anúncios com IA.")
  }

  if (res.status === 402) {
    // Cota mensal do plano esgotada — regra de NEGÓCIO, não falha de infra.
    // NUNCA cai pro fallback grátis/local aqui: fazer isso anularia o
    // controle de cota (o usuário simplesmente contornaria o limite do
    // plano toda vez que atingisse o teto). Lança QuotaExceededError (não
    // um Error genérico) pra UI poder abrir o modal de upgrade.
    const data = await res.json().catch(() => null)
    throw new QuotaExceededError(
      data?.error || "Limite mensal do seu plano atingido. Faça upgrade para continuar gerando com IA.",
      data?.quota ?? null,
    )
  }

  if (!res.ok) {
    // Falha do servidor que não é de autenticação nem de cota — ainda vale a resiliência de infra.
    return freeFallback(input, signal)
  }

  const data = (await res.json()) as GenerateAdResult
  if (!data?.payload) throw new Error("Resposta da API sem payload.")
  return data
}
