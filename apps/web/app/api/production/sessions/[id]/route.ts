// GET /api/production/sessions/:id
// Consulta o estado atual da sessão — a mesma restauração de estado que a
// spec do Director Engine promete (§7.2): o cliente nunca precisa guardar
// o estágio localmente, só reconsultar aqui.
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { proxyToDirectorEngine } from "@/lib/production/backend-proxy"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const result = await proxyToDirectorEngine(
    `/api/v1/engines/director/sessions/${id}?tenantId=${encodeURIComponent(auth.user.tenantId)}`,
    { method: "GET" },
  )
  return NextResponse.json(result.body, { status: result.status })
}
