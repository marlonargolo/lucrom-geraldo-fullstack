// Consulta os dados do painel `/studio/admin` (equipe Criatai) — GET
// /api/v1/admin/overview | /activity | /risk-alerts no backend (ver
// legacy/api/src/admin/admin.controller.ts, protegido por
// PlatformAdminGuard). Chega até aqui só quem já passou pelo
// RequirePlatformAdmin em lib/auth/require-platform-admin.tsx.

import { apiFetch } from "@/lib/api/client"
import { getSession } from "@/lib/auth/session-store"

export interface AdminOverview {
  tenants: { total: number; byPlan: Record<string, number> }
  users: { total: number; activeLast30d: number }
  jobs: {
    total: number
    done: number
    failed: number
    inProgress: number
    successRate: number
  }
  revenue: {
    approvedCentsLast30d: number
    approvedCentsTotal: number
  }
  providers: Array<{
    provider: string
    total: number
    done: number
    failed: number
    successRate: number
  }>
}

export interface AdminActivityItem {
  kind: "tenant_created" | "payment_approved" | "job_done" | "job_failed"
  label: string
  createdAt: string
}

export interface AdminRiskAlert {
  tenantId: string
  tenantName: string
  jobsLastHour: number
  reason: string
}

/**
 * Retorna `null` quando: sem sessão ativa ou qualquer falha de rede/permissão
 * — mesmo padrão best-effort de lib/usage/quota-client.ts. A UI trata `null`
 * como estado de erro próprio (painel administrativo não deve fingir estar
 * vazio quando na verdade falhou em carregar).
 */
export async function fetchAdminOverview(): Promise<AdminOverview | null> {
  if (!getSession()) return null
  try {
    return await apiFetch<AdminOverview>("/api/v1/admin/overview")
  } catch {
    return null
  }
}

export async function fetchAdminActivity(limit = 12): Promise<AdminActivityItem[] | null> {
  if (!getSession()) return null
  try {
    return await apiFetch<AdminActivityItem[]>(`/api/v1/admin/activity?limit=${limit}`)
  } catch {
    return null
  }
}

export async function fetchAdminRiskAlerts(thresholdPerHour = 20): Promise<AdminRiskAlert[] | null> {
  if (!getSession()) return null
  try {
    return await apiFetch<AdminRiskAlert[]>(`/api/v1/admin/risk-alerts?thresholdPerHour=${thresholdPerHour}`)
  } catch {
    return null
  }
}
