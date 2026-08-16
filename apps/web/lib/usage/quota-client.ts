// Consulta a cota mensal de IA do tenant SEM consumi-la (GET
// /api/v1/usage/peek no backend — ver apps/api/src/usage/usage.controller.ts).
// Usado só pra exibir "3/5 usadas este mês" na UI; quem de fato CONSOME a
// cota é a Route Handler /api/ai/generate-ad via
// lib/auth/require-user-quota.ts (POST /api/v1/usage/consume).

import { apiFetch } from "@/lib/api/client"
import { getSession } from "@/lib/auth/session-store"

export type PlanTier = "CREATOR" | "PRO" | "ENTERPRISE"

export interface QuotaPeek {
  allowed: boolean
  used: number
  limit: number
  plan: PlanTier
  periodStart: string
  extraCreditsRemaining?: number
}

/**
 * Retorna `null` quando: sem sessão ativa, backend não configurado, ou
 * qualquer falha de rede — best-effort, mesmo padrão do resto de
 * lib/api/client.ts. A UI trata `null` como "não mostrar nada" em vez de
 * erro, pra não poluir a tela com um problema que não impede o uso (o
 * gate de verdade é o /api/ai/generate-ad no momento de gerar).
 */
export async function fetchQuota(): Promise<QuotaPeek | null> {
  if (!getSession()) return null
  try {
    return await apiFetch<QuotaPeek>("/api/v1/usage/peek")
  } catch {
    return null
  }
}
