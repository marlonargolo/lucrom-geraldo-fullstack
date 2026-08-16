// POST /api/production/sessions/:id/creative
// Aciona o Creative Engine real — avança STRATEGY -> CREATIVE. Chama o LLM
// (ScriptGeneratorService/DeepSeek) — custo bem menor que a geração de
// vídeo em /production, então não debita cota de "1 vídeo" aqui (essa é
// debitada só no passo de produção, onde o custo pesado de fato acontece —
// ver nota em .../production/route.ts). Ainda assim, sem controle nenhum
// um tenant malicioso poderia martelar geração de roteiro indefinidamente;
// o rate limit abaixo cobre essa brecha.
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { proxyToDirectorEngine } from "@/lib/production/backend-proxy"
import { createRateLimiter } from "@/lib/rate-limit"

const isRateLimited = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  keyPrefix: "creative-advance",
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (!auth.ok) return auth.response

  if (await isRateLimited(auth.user.sub)) {
    return NextResponse.json(
      { error: "Muitas requisições de geração de roteiro. Tente novamente em instantes." },
      { status: 429 },
    )
  }

  const { id } = await params
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // corpo vazio é válido aqui (voiceId é opcional) — só rejeita JSON malformado com conteúdo
  }

  const result = await proxyToDirectorEngine(`/api/v1/engines/director/sessions/${id}/creative`, {
    method: "POST",
    body: { ...body, tenantId: auth.user.tenantId },
  })
  return NextResponse.json(result.body, { status: result.status })
}
