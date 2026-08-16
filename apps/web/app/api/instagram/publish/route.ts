// POST /api/instagram/publish
//
// Publica um Reels no Instagram via Meta Graph API, em 3 etapas (fluxo
// oficial de "Content Publishing" da Meta para Reels):
//
//   Etapa 1 — POST /{ig-user-id}/media          (media_type=REELS) -> container id
//   Etapa 2 — GET  /{container-id}?fields=status_code  (polling até FINISHED)
//   Etapa 3 — POST /{ig-user-id}/media_publish  (creation_id=container id) -> media id
//
// PRÉ-REQUISITOS que este endpoint assume (fora do escopo deste arquivo):
//   1. `videoUrl` precisa ser uma URL HTTPS PÚBLICA — a Graph API busca o
//      vídeo ela mesma, não aceita upload direto/blob. O video-generator.tsx
//      hoje renderiza o vídeo no navegador (canvas + MediaRecorder) como um
//      Blob local, então falta uma etapa de upload pra um storage público
//      (Vercel Blob, S3, Supabase Storage, ou o backend NestJS em apps/api)
//      ANTES de chamar esta rota. Isso não foi implementado aqui.
//   2. A conta do Instagram precisa ser Business/Creator, conectada a uma
//      Página do Facebook, com um token de acesso de longa duração que
//      tenha a permissão `instagram_content_publish` aprovada pela Meta.
//
// SEGURANÇA — mesmo padrão das rotas anteriores (generate-ad, status):
// INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_BUSINESS_ACCOUNT_ID são lidos de
// process.env SEM prefixo NEXT_PUBLIC_, então nunca chegam ao bundle do
// navegador. Esta rota é o único lugar autorizado a falar com a Graph API.
//
// IMPORTANTE sobre tempo de execução: o processamento de um Reels pela Meta
// pode levar de alguns segundos a poucos minutos. Serverless functions têm
// limite de execução dependendo do provedor/plano (ex.: Vercel Hobby ~10s,
// Pro até 300s com `maxDuration`). Se seu vídeo demorar mais que o tempo
// máximo de polling configurado abaixo, a rota retorna `stage:
// "processing_timeout"` com o `containerId` — dá pra checar o status depois
// numa chamada separada em vez de re-tentar publicar do zero.
export const runtime = "nodejs"
export const maxDuration = 300

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createRateLimiter } from "@/lib/rate-limit"

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0"
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

const IG_USER_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ?? ""
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN ?? ""

const POLL_INTERVAL_MS = Number(process.env.INSTAGRAM_POLL_INTERVAL_MS) || 4000
const POLL_MAX_ATTEMPTS = Number(process.env.INSTAGRAM_POLL_MAX_ATTEMPTS) || 45 // ~3min no default

const MAX_CAPTION_LEN = 2200 // limite oficial de legenda do Instagram

// Publicar é uma ação de efeito real (posta publicamente), então
// protegemos mais do que a rota de geração de texto. A própria Meta já
// limita a 25 publicações/24h por conta; isso aqui é só uma primeira
// barreira contra clique duplo / retry em loop no cliente. Ver
// lib/rate-limit.ts para o comportamento (Redis distribuído com fallback
// local em memória).
const isRateLimited = createRateLimiter({
  windowMs: 10 * 60_000,
  maxRequests: 5,
  keyPrefix: "instagram-publish",
})
// ---------------------------------------------------------------------------
// Tipos da Graph API (só os campos que usamos)
// ---------------------------------------------------------------------------
interface GraphError {
  message: string
  type: string
  code: number
  error_subcode?: number
  fbtrace_id?: string
}

interface GraphErrorEnvelope {
  error: GraphError
}

interface CreateContainerResponse {
  id: string
}

type ContainerStatusCode = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED"

interface ContainerStatusResponse {
  status_code: ContainerStatusCode
  status?: string
}

interface PublishResponse {
  id: string
}

function isGraphError(data: unknown): data is GraphErrorEnvelope {
  return typeof data === "object" && data !== null && "error" in data
}

/**
 * Traduz os erros mais comuns da Graph API pra mensagens acionáveis em
 * português. Os códigos abaixo são os documentados/observados com mais
 * frequência para Content Publishing — a Meta pode ajustar isso ao longo do
 * tempo, então sempre incluímos a mensagem original da Graph API junto,
 * pra nunca esconder a causa real caso o mapeamento fique desatualizado.
 */
function describeGraphError(err: GraphError): { friendly: string; httpStatus: number } {
  // Token inválido/expirado.
  if (err.code === 190) {
    return {
      friendly: "Token de acesso do Instagram expirado ou inválido. Reconecte a conta do Instagram.",
      httpStatus: 401,
    }
  }
  // Permissão ausente (ex.: instagram_content_publish não concedida/aprovada).
  if (err.code === 200 || err.code === 10 || err.code === 294) {
    return {
      friendly:
        "Sem permissão para publicar nesta conta do Instagram. Verifique se o app tem a permissão " +
        "'instagram_content_publish' aprovada e se a conta é Business/Creator conectada a uma Página do Facebook.",
      httpStatus: 403,
    }
  }
  // Limite de publicações atingido (Meta permite até 25 publicações/24h por conta).
  if (err.error_subcode === 2207052 || /publishing limit/i.test(err.message)) {
    return {
      friendly: "Limite diário de publicações do Instagram atingido (até 25 a cada 24h). Tente novamente mais tarde.",
      httpStatus: 429,
    }
  }
  // Parâmetro inválido — geralmente video_url inacessível ou formato/duração fora do suportado.
  if (err.code === 100) {
    return {
      friendly:
        "Parâmetro inválido para a Graph API. Confira se 'videoUrl' é uma URL pública acessível e se o vídeo " +
        "atende aos requisitos do Reels (formato, duração, proporção).",
      httpStatus: 400,
    }
  }
  return { friendly: `Erro da Graph API: ${err.message}`, httpStatus: 502 }
}

function timeout(ms: number, signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms)
    signal?.addEventListener("abort", () => {
      clearTimeout(t)
      reject(new Error("abort"))
    })
  })
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener("abort", () => {
      clearTimeout(t)
      reject(new Error("abort"))
    })
  })
}

/** Chamada genérica à Graph API com timeout e parse de erro padronizado. */
async function graphRequest<T>(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<{ ok: true; data: T } | { ok: false; error: GraphError }> {
  let res: Response
  try {
    res = (await Promise.race([fetch(url, { ...init, signal }), timeout(20000, signal)])) as Response
  } catch (e) {
    return {
      ok: false,
      error: { message: e instanceof Error ? e.message : "Falha de rede ao chamar a Graph API.", type: "network", code: -1 },
    }
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    return { ok: false, error: { message: "Resposta inválida (não-JSON) da Graph API.", type: "parse", code: -1 } }
  }

  if (!res.ok || isGraphError(data)) {
    const err = isGraphError(data) ? data.error : { message: `HTTP ${res.status}`, type: "http", code: res.status }
    return { ok: false, error: err }
  }

  return { ok: true, data: data as T }
}

// =============================================================================
// Etapa 1 — cria o container de mídia REELS
// =============================================================================
async function createReelsContainer(
  params: { videoUrl: string; caption?: string; coverUrl?: string; shareToFeed?: boolean; audioName?: string },
  signal?: AbortSignal,
) {
  const body = new URLSearchParams({
    media_type: "REELS",
    video_url: params.videoUrl,
    access_token: ACCESS_TOKEN,
  })
  if (params.caption) body.set("caption", params.caption)
  if (params.coverUrl) body.set("cover_url", params.coverUrl)
  if (params.audioName) body.set("audio_name", params.audioName)
  body.set("share_to_feed", String(params.shareToFeed ?? true))

  return graphRequest<CreateContainerResponse>(
    `${GRAPH_BASE}/${IG_USER_ID}/media`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
    signal,
  )
}

// =============================================================================
// Etapa 2 — poll do status do container até FINISHED (ou ERROR/EXPIRED)
// =============================================================================
async function pollContainerStatus(
  containerId: string,
  signal?: AbortSignal,
): Promise<
  | { done: true; ok: true }
  | { done: true; ok: false; error: GraphError }
  | { done: false } // esgotou as tentativas — ainda IN_PROGRESS
> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const result = await graphRequest<ContainerStatusResponse>(
      `${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${ACCESS_TOKEN}`,
      { method: "GET" },
      signal,
    )

    if (!result.ok) return { done: true, ok: false, error: result.error }

    if (result.data.status_code === "FINISHED") return { done: true, ok: true }

    if (result.data.status_code === "ERROR" || result.data.status_code === "EXPIRED") {
      return {
        done: true,
        ok: false,
        error: {
          message: `Processamento do container falhou (status_code=${result.data.status_code}).`,
          type: "container_status",
          code: -1,
        },
      }
    }

    // IN_PROGRESS (ou PUBLISHED, que não deveria aparecer nesta fase) — aguarda e tenta de novo.
    await sleep(POLL_INTERVAL_MS, signal)
  }

  return { done: false }
}

// =============================================================================
// Etapa 3 — publica o container
// =============================================================================
async function publishContainer(containerId: string, signal?: AbortSignal) {
  const body = new URLSearchParams({ creation_id: containerId, access_token: ACCESS_TOKEN })
  return graphRequest<PublishResponse>(
    `${GRAPH_BASE}/${IG_USER_ID}/media_publish`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
    signal,
  )
}

// =============================================================================
// Validação de input
// =============================================================================
interface PublishBody {
  videoUrl?: unknown
  caption?: unknown
  coverUrl?: unknown
  shareToFeed?: unknown
  audioName?: unknown
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

function validateInput(
  body: PublishBody,
):
  | { ok: true; input: { videoUrl: string; caption?: string; coverUrl?: string; shareToFeed?: boolean; audioName?: string } }
  | { ok: false; error: string } {
  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : ""
  if (!videoUrl) return { ok: false, error: "Campo 'videoUrl' é obrigatório." }
  if (!isHttpsUrl(videoUrl)) return { ok: false, error: "'videoUrl' precisa ser uma URL https:// pública." }

  const caption = typeof body.caption === "string" ? body.caption.trim() : undefined
  if (caption && caption.length > MAX_CAPTION_LEN) {
    return { ok: false, error: `'caption' excede o limite de ${MAX_CAPTION_LEN} caracteres do Instagram.` }
  }

  const coverUrl = typeof body.coverUrl === "string" ? body.coverUrl.trim() : undefined
  if (coverUrl && !isHttpsUrl(coverUrl)) return { ok: false, error: "'coverUrl' precisa ser uma URL https:// pública." }

  const shareToFeed = typeof body.shareToFeed === "boolean" ? body.shareToFeed : undefined
  const audioName = typeof body.audioName === "string" ? body.audioName.trim() : undefined

  return { ok: true, input: { videoUrl, caption, coverUrl, shareToFeed, audioName } }
}

// =============================================================================
// Handler
// =============================================================================
export async function POST(req: NextRequest) {
  const auth = requireUser(req)
  if (!auth.ok) return auth.response

  if (!IG_USER_ID || !ACCESS_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Integração com Instagram não configurada neste servidor. Defina INSTAGRAM_BUSINESS_ACCOUNT_ID e " +
          "INSTAGRAM_ACCESS_TOKEN no ambiente.",
      },
      { status: 501 },
    )
  }

  if (await isRateLimited(auth.user.sub)) {
    return NextResponse.json({ error: "Muitas tentativas de publicação. Aguarde alguns minutos." }, { status: 429 })
  }

  let body: PublishBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 })
  }

  const validated = validateInput(body)
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  try {
    // Etapa 1 — cria o container REELS.
    const created = await createReelsContainer(validated.input, req.signal)
    if (!created.ok) {
      const { friendly, httpStatus } = describeGraphError(created.error)
      return NextResponse.json({ stage: "create_container", error: friendly, graphError: created.error }, { status: httpStatus })
    }
    const containerId = created.data.id

    // Etapa 2 — poll até FINISHED.
    const status = await pollContainerStatus(containerId, req.signal)
    if (!status.done) {
      return NextResponse.json(
        {
          stage: "processing_timeout",
          containerId,
          error:
            "O vídeo ainda está sendo processado pela Meta e o tempo máximo de espera desta chamada foi atingido. " +
            "Guarde o 'containerId' e tente publicar novamente em alguns instantes (o container continua válido).",
        },
        { status: 202 },
      )
    }
    if (!status.ok) {
      const { friendly, httpStatus } = describeGraphError(status.error)
      return NextResponse.json({ stage: "poll_status", containerId, error: friendly, graphError: status.error }, { status: httpStatus })
    }

    // Etapa 3 — publica.
    const published = await publishContainer(containerId, req.signal)
    if (!published.ok) {
      const { friendly, httpStatus } = describeGraphError(published.error)
      return NextResponse.json({ stage: "publish", containerId, error: friendly, graphError: published.error }, { status: httpStatus })
    }

    return NextResponse.json(
      { stage: "done", containerId, mediaId: published.data.id },
      { status: 200 },
    )
  } catch (err) {
    console.error("[api/instagram/publish] erro inesperado:", err)
    return NextResponse.json({ error: "Falha inesperada ao publicar no Instagram. Tente novamente." }, { status: 500 })
  }
}
