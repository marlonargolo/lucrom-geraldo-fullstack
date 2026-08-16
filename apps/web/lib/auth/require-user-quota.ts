// Extensão de requireUser() que ALÉM de validar o JWT, consome 1 unidade da
// cota mensal de IA do tenant (POST /api/v1/usage/consume no backend
// NestJS — ver apps/api/src/usage/*) antes de deixar a rota prosseguir.
//
// Por que a cota é checada no BACKEND (não em memória aqui no apps/web):
// cota é dado de negócio por tenant (ligado a plan_tier na tabela
// `tenants`), precisa ser consistente entre todas as instâncias do Next.js
// e sobreviver a restart/deploy — exatamente o que um contador em memória
// (como o rate-limit anti-abuso das outras rotas) NÃO garante. O backend já
// tem o Postgres e faz o incremento de forma atômica (uma única UPDATE
// condicional, sem corrida — ver UsageService.consume).
//
// Decisão de projeto: se o backend de cota estiver INALCANÇÁVEL (rede,
// timeout, 5xx), este helper falha FECHADO — nega a geração em vez de
// deixar passar sem checagem. Para um recurso que custa dinheiro real
// (Gemini/DeepSeek/fal.ai), "permitir por via das dúvidas" abriria uma
// brecha de custo ilimitado exatamente quando o controle de cota está
// indisponível — o pior momento possível pra isso acontecer.

import { NextRequest, NextResponse } from "next/server"
import { requireUser, type RequireUserResult } from "./require-user"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

interface QuotaConsumeResponse {
  allowed: boolean
  used: number
  limit: number
  plan: "CREATOR" | "PRO" | "ENTERPRISE"
  periodStart: string
  usedExtraCredit?: boolean
  extraCreditsRemaining?: number
}

export async function requireUserWithQuota(req: NextRequest): Promise<RequireUserResult> {
  const auth = requireUser(req)
  if (!auth.ok) return auth

  if (!API_BASE_URL) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Controle de cota indisponível (backend não configurado). Tente novamente mais tarde." },
        { status: 503 },
      ),
    }
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/usage/consume`, {
      method: "POST",
      headers: { "X-User-Token": req.headers.get("x-user-token") ?? "" },
    })
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Não foi possível confirmar sua cota de uso no momento. Tente novamente em instantes." },
        { status: 503 },
      ),
    }
  }

  if (res.status === 401) {
    // Não deveria acontecer (já validamos o JWT localmente acima), mas se o
    // backend rejeitar por qualquer motivo (ex.: usuário deletado), trata
    // como sessão inválida — mesma resposta de requireUser().
    return {
      ok: false,
      response: NextResponse.json({ error: "Sessão inválida ou expirada. Faça login novamente." }, { status: 401 }),
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Falha ao verificar sua cota de uso. Tente novamente." },
        { status: 503 },
      ),
    }
  }

  const quota = (await res.json()) as QuotaConsumeResponse
  if (!quota.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Seu vídeo grátis do mês (plano ${quota.plan}, ${quota.used}/${quota.limit}) já foi usado e você não tem créditos avulsos. Compre 1 vídeo avulso por R$ 39,90 ou o pacote de 5 vídeos por R$ 179,90, ou faça upgrade de plano para continuar.`,
          quota,
        },
        { status: 402 },
      ),
    }
  }

  return auth
}
