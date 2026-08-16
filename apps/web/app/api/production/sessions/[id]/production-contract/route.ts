// GET /api/production/sessions/:id/production-contract
// Consulta o contrato de produção mais recente da sessão — usado pra
// descobrir o `ai_generation_job_id` e acompanhar o progresso da geração
// real disparada em POST .../production (ver DirectorService.advanceProduction).
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { proxyToDirectorEngine } from "@/lib/production/backend-proxy"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const result = await proxyToDirectorEngine(
    `/api/v1/engines/director/sessions/${id}/production-contract?tenantId=${encodeURIComponent(auth.user.tenantId)}`,
    { method: "GET" },
  )
  return NextResponse.json(result.body, { status: result.status })
}
