// POST /api/production/sessions/:id/production
// Avança CREATIVE -> PRODUCTION e dispara a geração real de vídeo
// (AiOrchestratorService — Kling primário, MiniMax fallback), usando o
// roteiro do Creative Manifest como prompt. `tenantId` vem do JWT do
// usuário autenticado (auth.user.tenantId), nunca de um campo enviado pelo
// cliente — evita que alguém dispare geração em nome de outro tenant só
// trocando um campo no payload (mesmo cuidado já aplicado em
// billing.controller.ts).
//
// BLINDAGEM FINANCEIRA (auditoria pós-lançamento AVULSO/PACOTE5): esta era
// a rota mais cara de toda a stack — dispara Kling/MiniMax, provedor pago
// por chamada — e não tinha NENHUM controle de cota nem rate limit, ao
// contrário de /api/ai/generate-ad. A cota (mensal + créditos avulsos) hoje
// é debitada de forma atômica e autoritativa dentro do backend
// (AiOrchestratorService.submit(), o único ponto por onde toda geração de
// vídeo real passa — inclusive o endpoint legado do briefing-composer) e
// responde 402 automaticamente quando esgotada; o rate limit abaixo é uma
// segunda camada (defesa em profundidade) só pra evitar martelar o backend
// com requisições repetidas antes mesmo dessa checagem rodar.
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { proxyToDirectorEngine } from "@/lib/production/backend-proxy"
import { createRateLimiter } from "@/lib/rate-limit"

const isRateLimited = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 5,
  keyPrefix: "production-advance",
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (!auth.ok) return auth.response

  if (await isRateLimited(auth.user.sub)) {
    return NextResponse.json(
      { error: "Muitas requisições de geração de vídeo. Tente novamente em instantes." },
      { status: 429 },
    )
  }

  const { id } = await params
  const result = await proxyToDirectorEngine(`/api/v1/engines/director/sessions/${id}/production`, {
    method: "POST",
    body: { tenantId: auth.user.tenantId },
  })
  return NextResponse.json(result.body, { status: result.status })
}
