// Helper de autorização compartilhado pelas rotas que consomem provedores
// pagos ou executam ações com efeito real (geração de IA, upload, publicação
// no Instagram). Todas devem chamar `requireUser(req)` como primeira linha.
//
// Uso:
//   const auth = requireUser(req)
//   if (!auth.ok) return auth.response   // já é um 401 pronto
//   // auth.user.sub / auth.user.tenantId disponíveis daqui pra baixo

import { NextRequest, NextResponse } from "next/server"
import { verifyBackendJwt, type BackendJwtPayload } from "./verify-jwt"

export type RequireUserResult = { ok: true; user: BackendJwtPayload } | { ok: false; response: NextResponse }

export function requireUser(req: NextRequest): RequireUserResult {
  const token = req.headers.get("x-user-token")
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Faça login para usar este recurso (header X-User-Token ausente)." },
        { status: 401 },
      ),
    }
  }

  const user = verifyBackendJwt(token)
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sessão inválida ou expirada. Faça login novamente." },
        { status: 401 },
      ),
    }
  }

  return { ok: true, user }
}
