// POST /api/production/sessions/:id/business
// Aciona o Business Engine real — avança CREATED -> BUSINESS (ou ABORTED,
// se o score de "vale a pena produzir isso?" ficar abaixo do limiar).
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { proxyToDirectorEngine } from "@/lib/production/backend-proxy"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 })
  }

  const result = await proxyToDirectorEngine(`/api/v1/engines/director/sessions/${id}/business`, {
    method: "POST",
    body: { ...body, tenantId: auth.user.tenantId },
  })
  return NextResponse.json(result.body, { status: result.status })
}
