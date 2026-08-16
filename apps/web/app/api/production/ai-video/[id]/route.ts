// GET /api/production/ai-video/:id
// Consulta o status de um job de geração de vídeo (AiOrchestratorService —
// Kling/MiniMax). Quando o job chega em DONE e já tem `final_asset_id`
// (pós-processamento do video-render.worker.ts concluído), resolve também
// a URL assinada pra download/preview, pra frontend não precisar de uma
// segunda chamada.
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { proxyToDirectorEngine } from "@/lib/production/backend-proxy"

interface AiGenerationJobBody {
  id: string
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED"
  final_asset_id: string | null
  error_message: string | null
  [key: string]: unknown
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const tenantId = encodeURIComponent(auth.user.tenantId)
  const jobResult = await proxyToDirectorEngine<AiGenerationJobBody>(
    `/api/v1/engines/m8/ai-video/${id}?tenantId=${tenantId}`,
    { method: "GET" },
  )
  if (!jobResult.ok) {
    return NextResponse.json(jobResult.body, { status: jobResult.status })
  }

  const job = jobResult.body
  if (job.status !== "DONE" || !job.final_asset_id) {
    return NextResponse.json(job, { status: jobResult.status })
  }

  const assetResult = await proxyToDirectorEngine<{ download_url?: string }>(
    `/api/v1/media-assets/${job.final_asset_id}?tenantId=${tenantId}`,
    { method: "GET" },
  )
  return NextResponse.json({ ...job, download_url: assetResult.ok ? assetResult.body.download_url : null }, {
    status: jobResult.status,
  })
}
