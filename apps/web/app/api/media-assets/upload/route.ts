// POST /api/media-assets/upload  ->  POST /api/v1/media-assets/upload (NestJS)
//
// Upload multipart (foto/vídeo/documento de referência) usado por
// lib/media/media-upload-client.ts. Existe separado do proxy genérico
// (app/api/backend/[...path]) porque aquele só repassa JSON. Mesmas regras
// de segurança: exige usuário autenticado (X-User-Token), anexa o API_TOKEN
// só aqui no servidor e FORÇA o `tenant_id` do JWT — o navegador nunca
// escolhe em qual tenant o arquivo é gravado.
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
const API_TOKEN = process.env.API_TOKEN ?? ""
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

export async function POST(req: NextRequest) {
  if (!API_BASE_URL || !API_TOKEN) {
    return NextResponse.json({ error: "Backend não configurado neste servidor (API_TOKEN ausente)." }, { status: 501 })
  }

  const auth = requireUser(req)
  if (!auth.ok) return auth.response

  let incoming: FormData
  try {
    incoming = await req.formData()
  } catch {
    return NextResponse.json({ error: "Envie o arquivo como multipart/form-data (campo 'file')." }, { status: 400 })
  }

  const file = incoming.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Campo 'file' é obrigatório." }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Arquivo acima do limite de 100 MB." }, { status: 413 })
  }

  const form = new FormData()
  form.append("file", file, file.name)
  form.append("tenant_id", auth.user.tenantId)

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/media-assets/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      body: form,
    })
    const body = await res.json().catch(() => null)
    return NextResponse.json(body, { status: res.status })
  } catch (err) {
    console.error("[api/media-assets/upload] falha de rede chamando o backend:", err)
    return NextResponse.json({ error: "Backend indisponível no momento. Tente novamente." }, { status: 503 })
  }
}
