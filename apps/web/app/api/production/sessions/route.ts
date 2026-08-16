// POST /api/production/sessions
// Cria uma sessão no Director Engine real (apps/api/src/engines/director).
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { proxyToDirectorEngine } from "@/lib/production/backend-proxy"

export async function POST(req: NextRequest) {
  const auth = requireUser(req)
  if (!auth.ok) return auth.response

  let body: { brandId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 })
  }
  if (typeof body.brandId !== "string" || !body.brandId) {
    return NextResponse.json({ error: "Campo 'brandId' é obrigatório." }, { status: 400 })
  }

  const result = await proxyToDirectorEngine("/api/v1/engines/director/sessions", {
    method: "POST",
    body: { brandId: body.brandId, tenantId: auth.user.tenantId },
  })
  return NextResponse.json(result.body, { status: result.status })
}
