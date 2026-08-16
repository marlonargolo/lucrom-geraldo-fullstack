// GET/POST /api/backend/*  ->  proxy server-side pro backend NestJS (apps/api).
//
// Por que isso existe: `lib/api/client.ts` (o `apiFetch` genérico usado por
// consent-store, audit-panel, briefing-composer, quota-client,
// checkout-client, brand-client) chamava o backend NestJS DIRETO do
// navegador, usando `NEXT_PUBLIC_API_TOKEN` — um valor NEXT_PUBLIC_ é
// injetado no bundle do CLIENTE pelo Next.js, ou seja, o token estático do
// ApiTokenGuard (que autentica "sou o servidor confiável", não um tenant
// específico) ficava visível a QUALQUER visitante via view-source/devtools.
// Com o token exposto, endpoints protegidos só por ApiTokenGuard
// (POST /api/v1/consent, /api/v1/audit-gate-logs/*,
// POST /api/v1/engines/m8/ai-video/generate) ficavam acessíveis SEM LOGIN
// NENHUM, com qualquer tenant_id — ver auditoria de isolamento multi-tenant.
//
// A correção: o navegador nunca mais fala com o NestJS diretamente. Ele fala
// com ESTA rota (mesma origem), que:
//   1. exige um usuário autenticado de verdade (`requireUser`, JWT em
//      X-User-Token — o MESMO gate que já protegia as rotas de IA/mídia);
//   2. anexa o `API_TOKEN` (SEM prefixo NEXT_PUBLIC_ — nunca vai pro bundle)
//      só aqui, server-side;
//   3. pros dois endpoints que hoje aceitam `tenant_id` direto do corpo sem
//      cross-check nenhum no backend (consent, ai-video generate), SUBSTITUI
//      qualquer tenant_id enviado pelo valor real do JWT — o cliente não
//      escolhe mais de qual tenant ele "é";
//   4. o mesmo vale pra `?tenantId=` na query string (GET/POST de recursos
//      por id) — ver forceTenantIdInQuery, achada ao implementar o módulo
//      Ajuste Rápido Humano.
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
const API_TOKEN = process.env.API_TOKEN ?? "" // NUNCA process.env.NEXT_PUBLIC_API_TOKEN aqui — isso é o próprio bug que esta rota corrige.

/** Paths (relativos à raiz do NestJS) onde o backend confia em `tenant_id`/`tenant` do corpo sem verificar dono — força o valor real do JWT aqui. */
function forceTenantIdInBody(path: string, body: Record<string, unknown>, realTenantId: string): Record<string, unknown> {
  const needsOverride =
    path === "api/v1/consent" ||
    path === "api/v1/engines/m8/ai-video/generate" ||
    // Ajuste Rápido Humano — PATCH .../layers também aceita tenant_id cru no
    // corpo (mesmo contrato de compose()); força pro tenant real do JWT
    // pelo mesmo motivo dos dois de cima.
    /^api\/v1\/graphics\/[^/]+\/layers$/.test(path)
  if (!needsOverride) return body
  return { ...body, tenant_id: realTenantId }
}

/**
 * Praticamente todo controller do backend tem uma rota `GET .../tenant/:tenantId`
 * pra listar os recursos daquele tenant — e o `:tenantId` vem cru da URL, sem
 * NENHUM cross-check contra quem está chamando (o ApiTokenGuard não carrega
 * identidade nenhuma, só "sou o servidor confiável"). Em vez de caçar e
 * corrigir rota por rota (11 controllers e crescendo), a defesa fica aqui:
 * qualquer path terminando em `tenant/<qualquer-coisa>` tem esse último
 * segmento SUBSTITUÍDO pelo tenantId real do JWT antes de seguir pro
 * backend — o cliente nunca escolhe de qual tenant ele "é", em nenhuma rota,
 * atual ou futura.
 */
function forceTenantIdInPath(path: string, realTenantId: string): string {
  const segments = path.split("/")
  const tenantIdx = segments.lastIndexOf("tenant")
  if (tenantIdx === -1 || tenantIdx !== segments.length - 2) return path
  segments[segments.length - 1] = realTenantId
  return segments.join("/")
}

/**
 * Correção adicional (achada implementando o módulo Ajuste Rápido Humano):
 * as mesmas rotas que confiavam em `tenant_id` cru no CORPO também existem
 * como `?tenantId=` cru na QUERY STRING (GET /api/v1/graphics/:id,
 * GET /api/v1/media-assets/:id, POST /api/v1/graphics/:id/restore/:version)
 * — nenhuma delas passava por `forceTenantIdInBody` (que só olha o corpo),
 * então um usuário autenticado do tenant A podia, em tese, ler um recurso do
 * tenant B só sabendo o UUID do recurso e trocando `?tenantId=`. Mesma
 * defesa das outras duas: se a query tiver `tenantId`, o valor é SEMPRE
 * substituído pelo tenant real do JWT antes de seguir pro backend.
 */
function forceTenantIdInQuery(search: string, realTenantId: string): string {
  if (!search) return search
  const params = new URLSearchParams(search)
  if (params.has("tenantId")) params.set("tenantId", realTenantId)
  const next = params.toString()
  return next ? `?${next}` : ""
}

async function handle(req: NextRequest, path: string[]) {
  const auth = requireUser(req)
  if (!auth.ok) return auth.response

  if (!API_BASE_URL || !API_TOKEN) {
    return NextResponse.json({ error: "Backend não configurado neste servidor (API_TOKEN ausente)." }, { status: 501 })
  }

  const targetPath = forceTenantIdInPath(path.join("/"), auth.user.tenantId)
  const search = forceTenantIdInQuery(req.nextUrl.search, auth.user.tenantId)
  let body: unknown = undefined

  // PATCH entrou junto com o módulo Ajuste Rápido Humano (PATCH .../layers,
  // edição determinística sem IA) — mesmo tratamento de corpo/tenant do
  // POST, já que os dois métodos aqui só existem pra escrever dado do
  // próprio tenant autenticado.
  if (req.method === "POST" || req.method === "PATCH") {
    const parsed = await req.json().catch(() => ({}))
    body = forceTenantIdInBody(targetPath, (parsed ?? {}) as Record<string, unknown>, auth.user.tenantId)
  }

  try {
    const res = await fetch(`${API_BASE_URL}/${targetPath}${search}`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
        "X-User-Token": req.headers.get("x-user-token") ?? "",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const responseBody = await res.json().catch(() => null)
    return NextResponse.json(responseBody, { status: res.status })
  } catch (err) {
    console.error(`[backend-proxy] falha de rede chamando ${targetPath}:`, err)
    return NextResponse.json({ error: "Backend indisponível no momento. Tente novamente." }, { status: 503 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return handle(req, path)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return handle(req, path)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return handle(req, path)
}
