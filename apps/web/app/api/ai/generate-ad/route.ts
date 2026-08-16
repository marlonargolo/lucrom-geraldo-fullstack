// POST /api/ai/generate-ad
//
// Único ponto de entrada seguro para gerar o anúncio do MEI (hook/body/cta/
// visual/narração) usando os provedores de baixo custo de produção
// (lib/ai-services.ts: Gemini Flash -> DeepSeek -> Pollinations -> local).
//
// Por que uma Route Handler e não chamar lib/ai-services.ts direto do
// client: as chaves pagas (GEMINI_API_KEY, DEEPSEEK_API_KEY, FAL_API_KEY)
// só existem em process.env do lado do servidor. Rodando aqui dentro de
// `app/api/*`, o código nunca é enviado pro bundle do navegador — é a forma
// correta (e a única segura) de consumir lib/ai-services.ts a partir dos
// componentes client em components/studio/*.
//
// Requer autenticação: exige o header `X-User-Token` (JWT emitido pelo
// backend NestJS em POST /api/v1/auth/login) — ver lib/auth/require-user.ts.
// Sem token válido, responde 401 antes de gastar qualquer chamada paga.
// O rate limit abaixo agora é por usuário autenticado, não mais por IP.
//
// Cota mensal de negócio (SaaS multi-tenant): além do JWT, esta rota também
// consome 1 unidade da cota mensal de IA do tenant via
// lib/auth/require-user-quota.ts (POST /api/v1/usage/consume no backend —
// ver apps/api/src/usage/*). Se o tenant já atingiu o limite do plano
// (CREATOR: 5/mês), responde 402 Payment Required orientando o upgrade.
//
// `runtime = "nodejs"` é obrigatório (não "edge"): lib/ai-services.ts usa
// WebSocket global do Node 22+ para o Edge-TTS e leitura completa de
// process.env, que nem sempre está disponível/completa no runtime edge.
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { generateAdPayloadProduction } from "@/lib/ai-services"
import type { MeiInput } from "@/lib/ai/prompt-layer"
import { requireUserWithQuota } from "@/lib/auth/require-user-quota"
import { createRateLimiter } from "@/lib/rate-limit"

const MAX_FIELD_LEN = 200

// Protege as chaves pagas de abuso. Ver lib/rate-limit.ts para o
// comportamento (Redis distribuído com fallback local em memória).
const isRateLimited = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  keyPrefix: "generate-ad",
})

interface GenerateAdBody {
  businessType?: unknown
  offer?: unknown
  tone?: unknown
}

function validateInput(body: GenerateAdBody): { ok: true; input: MeiInput } | { ok: false; error: string } {
  const businessType = typeof body.businessType === "string" ? body.businessType.trim() : ""
  const offer = typeof body.offer === "string" ? body.offer.trim() : ""
  const tone = typeof body.tone === "string" ? body.tone.trim() : undefined

  if (!businessType) return { ok: false, error: "Campo 'businessType' é obrigatório." }
  if (!offer) return { ok: false, error: "Campo 'offer' é obrigatório." }
  if (businessType.length > MAX_FIELD_LEN) return { ok: false, error: "Campo 'businessType' muito longo." }
  if (offer.length > MAX_FIELD_LEN) return { ok: false, error: "Campo 'offer' muito longo." }
  if (tone && tone.length > MAX_FIELD_LEN) return { ok: false, error: "Campo 'tone' muito longo." }

  return { ok: true, input: { businessType, offer, tone } }
}

export async function POST(req: NextRequest) {
  const auth = await requireUserWithQuota(req)
  if (!auth.ok) return auth.response

  if (await isRateLimited(auth.user.sub)) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429 },
    )
  }

  let body: GenerateAdBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 })
  }

  const validated = validateInput(body)
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  try {
    // lib/ai-services.ts nunca lança (sempre cai pro fallback grátis/local),
    // mas o try/catch aqui é uma rede de segurança contra qualquer imprevisto.
    const result = await generateAdPayloadProduction(validated.input, req.signal)
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    console.error("[api/ai/generate-ad] erro inesperado:", err)
    return NextResponse.json(
      { error: "Não foi possível gerar o anúncio no momento. Tente novamente." },
      { status: 500 },
    )
  }
}
