// Storage temporária de vídeo — vira a `videoUrl` pública exigida pela Meta
// Graph API (Etapa 1 de app/api/instagram/publish/route.ts busca o vídeo
// ela mesma a partir dessa URL, não aceita upload direto de bytes).
//
// Mesma convenção de env do StorageService do backend (apps/api/src/storage)
// — S3_ENDPOINT/S3_PORT/S3_USE_SSL/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET —
// de propósito, pra quem já configurou o backend não precisar reconfigurar
// nada: se essas variáveis já existem no ambiente, o upload usa o mesmo
// bucket S3/MinIO. Sem S3_ACCESS_KEY, cai pro sistema de arquivos local em
// /tmp, servido por uma Route Handler própria com URL assinada (HMAC) e
// expiração — nunca um servidor de arquivos aberto.
//
// LIMITAÇÃO IMPORTANTE DO MODO LOCAL (leia antes de usar em produção):
// o fallback em disco só funciona se este processo Next.js for de longa
// duração (self-hosted / Docker / VM) e tiver uma URL pública estável
// (`PUBLIC_SITE_URL`). Em serverless efêmero (ex.: Vercel functions), cada
// invocação pode rodar num container diferente, e o arquivo gravado no
// upload pode não estar mais lá quando a Meta tentar buscá-lo depois — nesse
// tipo de deploy, configure S3/MinIO (ou outro storage externo) antes de
// usar a publicação no Instagram em produção.

import { Client as MinioClient } from "minio"
import { randomUUID, createHmac, timingSafeEqual } from "crypto"
import { promises as fs } from "fs"
import * as path from "path"
import * as os from "os"

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? ""
const S3_PORT = Number(process.env.S3_PORT) || 9000
const S3_USE_SSL = process.env.S3_USE_SSL === "true"
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? ""
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? ""
const S3_BUCKET = process.env.S3_BUCKET || "lucrom-studio-media"

const USE_S3 = Boolean(S3_ACCESS_KEY && S3_ENDPOINT)

// URL pública deste próprio app Next.js — necessária só no fallback local,
// pra montar uma URL absoluta https:// (a Graph API não aceita relativa).
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "")

// Segredo pra assinar as URLs do fallback local. Em produção, DEFINA
// MEDIA_SIGNING_SECRET — o valor abaixo é só pra não travar o ambiente de
// desenvolvimento, e um aviso é logado se ele estiver em uso.
const MEDIA_SIGNING_SECRET = process.env.MEDIA_SIGNING_SECRET || devFallbackSecret()

function devFallbackSecret(): string {
  console.warn(
    "[temp-video-storage] MEDIA_SIGNING_SECRET não definido — usando segredo de desenvolvimento. " +
      "Defina essa variável em produção, ou qualquer pessoa que descobrir o padrão poderia forjar URLs assinadas.",
  )
  return "dev-only-insecure-media-signing-secret"
}

const LOCAL_STORAGE_DIR = path.join(os.tmpdir(), "lucrom-web-uploads")
const LOCAL_URL_TTL_SECONDS = 2 * 60 * 60 // 2h — tempo de sobra pro processamento do Reels na Meta

let minioClient: MinioClient | null = null
let bucketReady: Promise<void> | null = null

function getMinioClient(): MinioClient {
  if (!minioClient) {
    minioClient = new MinioClient({
      endPoint: S3_ENDPOINT,
      port: S3_PORT,
      useSSL: S3_USE_SSL,
      accessKey: S3_ACCESS_KEY,
      secretKey: S3_SECRET_KEY,
    })
  }
  return minioClient
}

async function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const client = getMinioClient()
      const exists = await client.bucketExists(S3_BUCKET).catch(() => false)
      if (!exists) await client.makeBucket(S3_BUCKET)
    })()
  }
  return bucketReady
}

export interface TempVideoUploadResult {
  url: string
  key: string
  provider: "s3" | "local-fs"
  expiresAt: number // epoch ms
}

/**
 * Faz upload de um vídeo (Buffer) para storage temporário e retorna uma URL
 * pública HTTPS pronta pra usar em `videoUrl` na rota de publicação do
 * Instagram. Nunca retorna null — se o S3 falhar, cai pro fallback local
 * automaticamente (mesmo espírito de resiliência das rotas de IA).
 */
export async function uploadTempVideo(
  buffer: Buffer,
  opts: { contentType?: string; ext?: string } = {},
): Promise<TempVideoUploadResult> {
  const ext = opts.ext || "mp4"
  const contentType = opts.contentType || "video/mp4"
  const key = `mei-reels/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`

  if (USE_S3) {
    try {
      await ensureBucket()
      const client = getMinioClient()
      await client.putObject(S3_BUCKET, key, buffer, buffer.length, { "Content-Type": contentType })
      const expirySeconds = LOCAL_URL_TTL_SECONDS
      const url = await client.presignedGetObject(S3_BUCKET, key, expirySeconds)
      return { url, key, provider: "s3", expiresAt: Date.now() + expirySeconds * 1000 }
    } catch (err) {
      console.warn("[temp-video-storage] Upload S3/MinIO falhou, caindo pro fallback local:", err)
      // segue pro fallback abaixo
    }
  }

  return uploadToLocalFs(buffer, key, contentType)
}

async function uploadToLocalFs(buffer: Buffer, key: string, contentType: string): Promise<TempVideoUploadResult> {
  const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, "_"))
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, buffer)
  // Guarda o content-type ao lado do arquivo, pra servir corretamente depois.
  await fs.writeFile(`${filePath}.meta.json`, JSON.stringify({ contentType }))

  const expiresAt = Date.now() + LOCAL_URL_TTL_SECONDS * 1000
  const sig = signMediaToken(key, expiresAt)

  if (!PUBLIC_SITE_URL) {
    console.warn(
      "[temp-video-storage] PUBLIC_SITE_URL não definido — a URL gerada no fallback local não será absoluta " +
        "e a Meta Graph API não vai conseguir buscá-la. Defina PUBLIC_SITE_URL (ou configure S3/MinIO).",
    )
  }

  const url = `${PUBLIC_SITE_URL}/api/media/${encodeURIComponent(key)}?exp=${expiresAt}&sig=${sig}`
  return { url, key, provider: "local-fs", expiresAt }
}

/** Lê um arquivo do fallback local, pra Route Handler de servir (app/api/media/[key]/route.ts). */
export async function readLocalTempVideo(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, "_"))
    const buffer = await fs.readFile(filePath)
    let contentType = "video/mp4"
    try {
      const meta = JSON.parse(await fs.readFile(`${filePath}.meta.json`, "utf8"))
      if (typeof meta.contentType === "string") contentType = meta.contentType
    } catch {
      /* sem metadata, usa o default */
    }
    return { buffer, contentType }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Assinatura HMAC das URLs do fallback local — evita virar um servidor de
// arquivos aberto: só serve quem tiver a assinatura válida gerada no upload,
// e só até `exp` expirar.
// ---------------------------------------------------------------------------
export function signMediaToken(key: string, expiresAt: number): string {
  return createHmac("sha256", MEDIA_SIGNING_SECRET).update(`${key}.${expiresAt}`).digest("hex")
}

export function verifyMediaToken(key: string, expiresAt: number, sig: string): boolean {
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false
  const expected = Buffer.from(signMediaToken(key, expiresAt), "hex")
  const provided = Buffer.from(sig || "", "hex")
  if (expected.length !== provided.length) return false
  return timingSafeEqual(expected, provided)
}
