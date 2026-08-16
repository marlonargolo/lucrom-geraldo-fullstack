// Helper client-side que une as duas rotas server-side numa única chamada
// pro video-generator.tsx:
//
//   1. Upload do Blob renderizado -> POST /api/media/upload -> videoUrl pública
//   2. Injeta essa videoUrl no payload -> POST /api/instagram/publish
//
// Nenhuma chave (S3, Meta) passa pelo navegador em nenhum momento — os dois
// endpoints acima já cuidam disso (ver seus respectivos arquivos).
//
// AUTENTICAÇÃO: as duas rotas exigem `X-User-Token` (ver
// lib/auth/require-user.ts). Publicar tem efeito real (posta publicamente)
// e não tem fallback "grátis" que faça sentido — sem sessão, nem tentamos.

import { getSession, clearSession } from "@/lib/auth/session-store"

export type PublishStage = "uploading" | "create_container" | "poll_status" | "publish" | "done" | "processing_timeout"

export interface PublishReelParams {
  videoBlob: Blob
  caption?: string
  coverUrl?: string
  shareToFeed?: boolean
  audioName?: string
  signal?: AbortSignal
}

export interface PublishReelResult {
  ok: boolean
  stage: PublishStage
  videoUrl?: string
  containerId?: string
  mediaId?: string
  error?: string
}

function extForBlob(blob: Blob): string {
  if (blob.type === "video/webm") return "webm"
  if (blob.type === "video/quicktime") return "mov"
  return "mp4"
}

/** Etapa 0 (pré-requisito da Meta Graph API): sobe o vídeo pra storage temporário e retorna a URL pública. */
async function uploadVideoForPublishing(
  blob: Blob,
  accessToken: string,
  signal?: AbortSignal,
): Promise<{ url: string; key: string; provider: "s3" | "local-fs" }> {
  const form = new FormData()
  form.append("video", blob, `reel.${extForBlob(blob)}`)

  const res = await fetch("/api/media/upload", {
    method: "POST",
    headers: { "X-User-Token": accessToken },
    body: form,
    signal,
  })
  if (res.status === 401) {
    clearSession()
    throw new Error("__AUTH_EXPIRED__")
  }
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || `Falha no upload do vídeo (HTTP ${res.status}).`)
  }
  return data
}

/**
 * Fluxo completo: upload do Blob -> injeta a videoUrl resultante no payload
 * -> publica no Instagram (POST /api/instagram/publish, que faz as 3 etapas
 * da Graph API). Nunca lança — sempre resolve com `{ ok, stage, error? }`,
 * pra UI poder mostrar o estágio exato em que algo deu errado.
 */
export async function publishReel(params: PublishReelParams): Promise<PublishReelResult> {
  const session = getSession()
  if (!session) {
    return { ok: false, stage: "uploading", error: "Faça login para publicar no Instagram." }
  }

  let videoUrl: string
  try {
    const uploaded = await uploadVideoForPublishing(params.videoBlob, session.accessToken, params.signal)
    videoUrl = uploaded.url
  } catch (e) {
    const authExpired = e instanceof Error && e.message === "__AUTH_EXPIRED__"
    return {
      ok: false,
      stage: "uploading",
      error: authExpired
        ? "Sessão expirada. Faça login novamente para publicar."
        : e instanceof Error
          ? e.message
          : "Falha ao subir o vídeo para storage temporário.",
    }
  }

  try {
    const res = await fetch("/api/instagram/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Token": session.accessToken },
      // videoUrl injetada aqui — é o resultado da etapa de upload acima.
      body: JSON.stringify({
        videoUrl,
        caption: params.caption,
        coverUrl: params.coverUrl,
        shareToFeed: params.shareToFeed,
        audioName: params.audioName,
      }),
      signal: params.signal,
    })

    if (res.status === 401) {
      clearSession()
      return { ok: false, stage: "publish", videoUrl, error: "Sessão expirada. Faça login novamente para publicar." }
    }

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      return {
        ok: false,
        stage: (data?.stage as PublishStage) || "publish",
        videoUrl,
        containerId: data?.containerId,
        error: data?.error || `Falha ao publicar (HTTP ${res.status}).`,
      }
    }

    return {
      ok: data.stage === "done",
      stage: data.stage as PublishStage,
      videoUrl,
      containerId: data.containerId,
      mediaId: data.mediaId,
      error: data.stage !== "done" ? data.error : undefined,
    }
  } catch (e) {
    return {
      ok: false,
      stage: "publish",
      videoUrl,
      error: e instanceof Error ? e.message : "Falha de rede ao publicar no Instagram.",
    }
  }
}
