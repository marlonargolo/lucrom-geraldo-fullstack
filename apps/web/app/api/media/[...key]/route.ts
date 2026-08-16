// GET /api/media/[...key]?exp=...&sig=...
//
// Serve os arquivos do fallback LOCAL do storage temporário (ver
// lib/storage/temp-video-storage.ts). Só existe pro caso em que S3/MinIO
// não está configurado — quando S3 está configurado, a URL retornada no
// upload já é um presigned URL direto do MinIO/S3, e esta rota nem entra
// em ação.
//
// Protegida por assinatura HMAC + expiração (query params `exp`/`sig`),
// gerados no momento do upload — sem a assinatura válida, o pedido é
// rejeitado. Isso evita que esta rota vire um servidor de arquivos aberto
// para qualquer `key` adivinhada.
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { readLocalTempVideo, verifyMediaToken } from "@/lib/storage/temp-video-storage"

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: keyParts } = await params
  const key = keyParts.join("/")

  const exp = Number(req.nextUrl.searchParams.get("exp"))
  const sig = req.nextUrl.searchParams.get("sig") || ""

  if (!verifyMediaToken(key, exp, sig)) {
    return NextResponse.json({ error: "URL inválida ou expirada." }, { status: 403 })
  }

  const file = await readLocalTempVideo(key)
  if (!file) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.buffer.length),
      "Cache-Control": "private, max-age=3600",
    },
  })
}
