export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { proxyToDirectorEngine } from "@/lib/production/backend-proxy"

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const auth = requireUser(req)
  if (!auth.ok) return auth.response

  const { tenantId } = await params

  if (tenantId !== auth.user.tenantId) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const result = await proxyToDirectorEngine(
    `/api/v1/engines/m8/ai-video/tenant/${tenantId}`,
    { method: "GET" },
  )

  return NextResponse.json(result.body, { status: result.status })
}
