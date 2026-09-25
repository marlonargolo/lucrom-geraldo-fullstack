"use client"

// Upload de foto/vídeo do usuário para virar um `media_assets` já existente
// no tenant — usado pelo Laboratório de Peças ("Usar minhas fotos e vídeos")
// pra aplicar a imagem como fundo de uma peça gráfica logo após ela ser
// composta (troca de ativo determinística, via graphicComposerClient.updateLayers).
//
// Vai pela Route Handler app/api/media-assets/upload (mesma origem), que
// autentica o usuário e repassa pro endpoint do NestJS
// POST /api/v1/media-assets/upload com o tenant_id real do JWT. Não usa
// `apiFetch` porque esse helper força Content-Type: application/json, o que
// quebraria o multipart (o navegador precisa definir o boundary sozinho).

import { ApiError } from "@/lib/api/client"
import { getSession } from "@/lib/auth/session-store"

export interface UploadedMediaAsset {
  id: string
  [key: string]: unknown
}

export const mediaUploadClient = {
  /** Envia um arquivo (imagem ou vídeo) e devolve o `media_asset` registrado (com `id`). */
  async upload(file: File): Promise<UploadedMediaAsset> {
    const session = getSession()
    if (!session) throw new ApiError("Faça login para enviar arquivos.", 401)

    const form = new FormData()
    form.append("file", file)

    const res = await fetch("/api/media-assets/upload", {
      method: "POST",
      headers: { "X-User-Token": session.accessToken },
      body: form,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new ApiError(`Falha no upload (HTTP ${res.status}): ${body}`, res.status)
    }

    return (await res.json()) as UploadedMediaAsset
  },
}
