// POST /api/media/upload
//
// Recebe o Blob de vídeo renderizado no navegador (video-generator.tsx —
// canvas + MediaRecorder) como multipart/form-data, armazena em storage
// temporário (S3/MinIO se configurado, senão fallback local — ver
// lib/storage/temp-video-storage.ts) e devolve uma URL pública HTTPS pronta
// pra ser usada como `videoUrl` em POST /api/instagram/publish.
//
// Requer autenticação (X-User-Token) — ver lib/auth/require-user.ts.
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { uploadTempVideo } from "@/lib/storage/temp-video-storage"
import { requireUser } from "@/lib/auth/require-user"
import { createRateLimiter } from "@/lib/rate-limit"

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024 // 200MB — bem acima do que um Reels de MEI (15-60s) deveria pesar
const ALLOWED_CONTENT_TYPES = ["video/mp4", "video/webm", "video/quicktime"]

// Ver lib/rate-limit.ts para o comportamento (Redis distribuído com
// fallback local em memória).
const isRateLimited = createRateLimiter({
  windowMs: 10 * 60_000,
  maxRequests: 15,
  keyPrefix: "media-upload",
})

function extForContentType(type: string): string {
  if (type === "video/webm") return "webm"
  if (type === "video/quicktime") return "mov"
  return "mp4"
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req)
  if (!auth.ok) return auth.response

  if (await isRateLimited(auth.user.sub)) {
    return NextResponse.json({ error: "Muitas tentativas de upload. Aguarde alguns minutos." }, { status: 429 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json(
      { error: "Corpo inválido — envie multipart/form-data com o campo 'video'." },
      { status: 400 },
    )
  }

  const file = form.get("video")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Campo 'video' ausente ou não é um arquivo." }, { status: 400 })
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Arquivo de vídeo vazio." }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Vídeo muito grande (máximo ${(MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)}MB).` },
      { status: 413 },
    )
  }

  const contentType = ALLOWED_CONTENT_TYPES.includes(file.type) ? file.type : "video/mp4"

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadTempVideo(buffer, { contentType, ext: extForContentType(contentType) })
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    console.error("[api/media/upload] erro inesperado:", err)
    return NextResponse.json({ error: "Falha ao armazenar o vídeo. Tente novamente." }, { status: 500 })
  }
}
