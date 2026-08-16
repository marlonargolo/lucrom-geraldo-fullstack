// Verificação do JWT emitido pelo backend NestJS (POST /api/v1/auth/login,
// ver apps/api/src/auth/auth.service.ts). Validação LOCAL (sem round-trip
// de rede pro backend a cada chamada), usando o mesmo segredo simétrico
// HS256 que o `JwtModule.registerAsync` do backend usa
// (apps/api/src/auth/auth.module.ts + apps/api/.env: JWT_SECRET).
//
// IMPORTANTE: JWT_SECRET aqui precisa ser EXATAMENTE o mesmo valor
// configurado em apps/api/.env — são dois processos diferentes validando o
// mesmo token com o mesmo segredo compartilhado. Sem isso configurado (ou
// com valores diferentes), toda validação falha e as rotas /api/ai/*
// retornam 401 pra todo mundo, inclusive usuários legítimos.
//
// Por que verificação local em vez de perguntar pro backend a cada request:
// menos latência, menos acoplamento de disponibilidade (uma rota de IA não
// devia cair porque o backend está lento), e o payload já tem tudo que
// precisamos (sub/tenantId/email/role) sem round-trip extra.

import { createHmac, timingSafeEqual } from "crypto"

const JWT_SECRET = process.env.JWT_SECRET ?? ""

export interface BackendJwtPayload {
  sub: string
  tenantId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

function base64UrlDecode(input: string): Buffer | null {
  try {
    return Buffer.from(input, "base64url")
  } catch {
    return null
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Verifica um JWT HS256 emitido pelo backend. Retorna o payload tipado se
 * válido, ou `null` para qualquer motivo de falha (assinatura errada,
 * expirado, alg diferente de HS256, shape inesperado, segredo ausente).
 * Nunca lança — quem chama só precisa checar `null`.
 */
export function verifyBackendJwt(token: string): BackendJwtPayload | null {
  if (!JWT_SECRET) {
    console.error(
      "[verify-jwt] JWT_SECRET não configurado neste processo (apps/web) — defina o mesmo valor usado em " +
        "apps/api/.env. Sem isso, nenhum token de usuário pode ser validado.",
    )
    return null
  }
  if (!token || typeof token !== "string") return null

  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sigB64] = parts

  const headerRaw = base64UrlDecode(headerB64)
  if (!headerRaw) return null
  let header: unknown
  try {
    header = JSON.parse(headerRaw.toString("utf8"))
  } catch {
    return null
  }
  // Rejeita explicitamente qualquer alg diferente de HS256 — inclusive o
  // clássico ataque "alg: none" (token sem assinatura, mas com payload
  // arbitrário). Nunca decida o algoritmo com base no que o token diz sem
  // checar contra o esperado.
  if (!isPlainObject(header) || header.alg !== "HS256") return null

  const expectedSig = createHmac("sha256", JWT_SECRET).update(`${headerB64}.${payloadB64}`).digest()
  const providedSig = base64UrlDecode(sigB64)
  if (!providedSig || expectedSig.length !== providedSig.length) return null
  if (!timingSafeEqual(expectedSig, providedSig)) return null

  const payloadRaw = base64UrlDecode(payloadB64)
  if (!payloadRaw) return null
  let payload: unknown
  try {
    payload = JSON.parse(payloadRaw.toString("utf8"))
  } catch {
    return null
  }
  if (!isPlainObject(payload)) return null

  if (typeof payload.exp === "number" && Date.now() >= payload.exp * 1000) return null // expirado

  const { sub, tenantId, email, role } = payload
  if (typeof sub !== "string" || typeof tenantId !== "string" || typeof email !== "string" || typeof role !== "string") {
    return null
  }

  return { sub, tenantId, email, role, iat: payload.iat as number | undefined, exp: payload.exp as number | undefined }
}
