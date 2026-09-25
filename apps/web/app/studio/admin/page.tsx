"use client"

// Painel `/studio/admin` (equipe Criatai) — antes 100% mockado
// (números fixos). Agora consome dados reais de GET /api/v1/admin/* (ver
// legacy/api/src/admin/admin.service.ts). Só chega aqui quem passou por
// RequirePlatformAdmin (App.tsx), então não precisamos checar permissão de
// novo — só sessão + resposta da API.
//
// "Saúde dos serviços" do mock antigo (API principal/Fila de
// render/Storage/Meta Graph API com badge "operacional" fixo) foi REMOVIDA
// de propósito: não existe hoje nenhum health-check real dessas peças no
// backend, e um badge verde fixo é pior que não mostrar nada — daria falsa
// confiança de uptime pra quem toma decisão em cima disso. No lugar,
// mostramos a saúde por PROVEDOR DE IA (Kling/MiniMax), que o
// AdminService de fato calcula a partir de ai_generation_jobs.
// Mesmo raciocínio pra "Integrações 4/6": não existe contagem real de
// integrações no schema, então o card vira "Alertas de risco" (dado real).

import { useEffect, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, TrendingUp, Users, XCircle } from "lucide-react"
import {
  fetchAdminOverview,
  fetchAdminActivity,
  fetchAdminRiskAlerts,
  type AdminOverview,
  type AdminActivityItem,
  type AdminRiskAlert,
} from "@/lib/admin/admin-client"
import { getSession } from "@/lib/auth/session-store"

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(0, Math.round(diffMs / 60000))
  if (minutes < 1) return "agora"
  if (minutes < 60) return `${minutes} min atrás`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h atrás`
  return `${Math.round(hours / 24)} d atrás`
}

const ACTIVITY_ICON: Record<AdminActivityItem["kind"], typeof CheckCircle2> = {
  tenant_created: Users,
  payment_approved: TrendingUp,
  job_done: CheckCircle2,
  job_failed: XCircle,
}

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [activity, setActivity] = useState<AdminActivityItem[] | null>(null)
  const [riskAlerts, setRiskAlerts] = useState<AdminRiskAlert[] | null>(null)
  const [loading, setLoading] = useState(true)
  const session = getSession()

  useEffect(() => {
    if (!session) {
      setLoading(false)
      return
    }
    Promise.all([fetchAdminOverview(), fetchAdminActivity(), fetchAdminRiskAlerts()])
      .then(([ov, act, risk]) => {
        setOverview(ov)
        setActivity(act)
        setRiskAlerts(risk)
      })
      .finally(() => setLoading(false))
  }, [session?.accessToken])

  if (!session) {
    return (
      <section className="mx-auto max-w-6xl rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Entre na sua conta para acessar a administração.
      </section>
    )
  }
  if (loading) {
    return (
      <section className="mx-auto max-w-6xl rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Carregando visão geral da plataforma...
      </section>
    )
  }
  if (!overview) {
    return (
      <section className="mx-auto max-w-6xl rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Não foi possível carregar os dados administrativos. Verifique se sua conta tem permissão de administrador de plataforma.
      </section>
    )
  }

  const stats = [
    { label: "Usuários ativos (30d)", value: overview.users.activeLast30d.toLocaleString("pt-BR"), detail: `${overview.users.total.toLocaleString("pt-BR")} no total`, Icon: Users },
    { label: "Jobs processados", value: overview.jobs.total.toLocaleString("pt-BR"), detail: `${overview.jobs.done.toLocaleString("pt-BR")} concluídos`, Icon: Activity },
    { label: "Taxa de sucesso", value: formatPercent(overview.jobs.successRate), detail: `${overview.jobs.failed.toLocaleString("pt-BR")} falhas`, Icon: CheckCircle2 },
    { label: "Receita aprovada (30d)", value: formatBRL(overview.revenue.approvedCentsLast30d), detail: `${formatBRL(overview.revenue.approvedCentsTotal)} total`, Icon: TrendingUp },
  ]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-primary">Operações</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Administração</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visão geral da plataforma, usuários, consumo e provedores de IA.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, detail, Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 font-display text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-primary">{detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Atividade recente</h2>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary">tempo real</span>
          </div>
          <div className="flex flex-col gap-3">
            {!activity || activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>
            ) : (
              activity.map((item, index) => {
                const Icon = ACTIVITY_ICON[item.kind]
                return (
                  <div key={`${item.createdAt}-${index}`} className="flex items-center gap-3 border-b border-border pb-3 last:border-0">
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{formatRelative(item.createdAt)}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Provedores de IA</h2>
          <div className="flex flex-col gap-3">
            {overview.providers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem gerações registradas ainda.</p>
            ) : (
              overview.providers.map((p) => (
                <div key={p.provider} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <span className="text-sm capitalize">{p.provider}</span>
                  <span className="flex items-center gap-1.5 text-xs text-primary">
                    {p.successRate >= 0.9 ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    )}
                    {formatPercent(p.successRate)} · {p.done}/{p.total}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {riskAlerts && riskAlerts.length > 0 && (
        <section className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h2 className="font-semibold">Alertas de risco</h2>
          </div>
          <div className="flex flex-col gap-2">
            {riskAlerts.map((alert) => (
              <div key={alert.tenantId} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <span className="text-sm">{alert.tenantName}</span>
                <span className="text-xs text-warning">{alert.reason}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
