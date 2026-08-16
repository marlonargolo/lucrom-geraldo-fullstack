// GET /api/ai/status
//
// Expõe getAiServicesStatus() (lib/ai-services.ts) pro frontend de forma
// segura: só retorna booleans indicando se cada provedor pago está
// configurado (chave presente), nunca as chaves em si. Usado pelo
// audit-panel.tsx para os badges "qual provedor de IA está ativo".
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getAiServicesStatus } from "@/lib/ai-services"

export async function GET() {
  return NextResponse.json(getAiServicesStatus(), {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  })
}
