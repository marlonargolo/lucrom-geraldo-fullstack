"use client"

import { useEffect, useState } from "react"
import { ShieldCheck, Check, Clock, X, UserCheck, ScrollText, Gauge, FlaskConical, Cpu, Image as ImageIcon, Mic } from "lucide-react"
import { cn } from "@/lib/utils"
import { AUDIT_GATES } from "@/lib/studio-data"
import type { GateResult, AuditEntry, ProductionStatus } from "@/lib/use-production"
import { apiFetch, isApiConfigured, DEFAULT_TENANT_ID } from "@/lib/api/client"
import type { AiServicesStatus } from "@/lib/ai-services"

// Revisor "logado" — na fase com banco vem da sessão autenticada (RBAC).
const REVIEWER = "Diretor de Criação"

interface Props {
  gates: Record<string, GateResult>
  auditLog: AuditEntry[]
  status: ProductionStatus
  onDecideGate: (gateId: string, action: "approved" | "rejected", reviewer: string) => void
}

/** Formato de `audit_logs` retornado por GET /api/v1/audit (apps/api/src/audit-trail). */
interface RemoteAuditEntry {
  id: string
  actor: string
  method: string
  route: string
  status_code: number
  created_at: string
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

/** Resolve qual provedor está ativo pra cada capacidade, dado o status vindo de /api/ai/status. */
function resolveActiveProvider(status: AiServicesStatus | null) {
  return {
    text: status?.text.geminiFlash
      ? { label: "Gemini Flash", premium: true }
      : status?.text.deepSeek
        ? { label: "DeepSeek", premium: true }
        : { label: "IA grátis (Pollinations)", premium: false },
    image: status?.image.fluxFal
      ? { label: "FLUX.1 (fal.ai)", premium: true }
      : { label: "FLUX grátis (Pollinations)", premium: false },
    narration: status?.narration.edgeTts
      ? { label: "Edge-TTS", premium: true }
      : { label: "TTS grátis (Pollinations)", premium: false },
  }
}

/** Badge de status de um provedor de IA — verde/"ativo" se pago e configurado, neutro se rodando no fallback grátis. */
function ProviderBadge({
  icon: Icon,
  capability,
  provider,
}: {
  icon: typeof Cpu
  capability: string
  provider: { label: string; premium: boolean }
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-1.5",
        provider.premium ? "border-success/30 bg-success/5" : "border-border bg-secondary/40",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          provider.premium ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground",
        )}
      >
        <Icon className="h-3 w-3" aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{capability}</span>
        <span className={cn("text-[11px] font-semibold", provider.premium ? "text-success" : "text-foreground")}>
          {provider.label}
        </span>
      </span>
    </div>
  )
}

export function AuditPanel({ gates, auditLog, status, onDecideGate }: Props) {
  // Painel de Auditoria Dinâmico: busca a trilha real do backend em vez de
  // depender só da simulação local. `null` = ainda não carregou ou API
  // indisponível — nesse caso, cai de volta para `auditLog` (local), então o
  // painel nunca fica vazio/quebrado se a API não estiver configurada.
  const [remoteAuditLog, setRemoteAuditLog] = useState<RemoteAuditEntry[] | null>(null)

  // Status dos provedores de IA de baixo custo (Fase 2) — GET /api/ai/status,
  // que só expõe booleans (chave configurada ou não), nunca as chaves em si.
  // `null` = ainda carregando ou indisponível; nesse caso os badges assumem
  // o pior caso seguro (só fallback grátis/local), já que é sempre verdade.
  const [aiStatus, setAiStatus] = useState<AiServicesStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/ai/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AiServicesStatus | null) => {
        if (!cancelled && data) setAiStatus(data)
      })
      .catch(() => {
        /* silencioso: badges caem pro estado padrão (fallback grátis) */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isApiConfigured()) return
    let cancelled = false

    apiFetch<RemoteAuditEntry[]>(`/api/v1/audit?tenant_id=${DEFAULT_TENANT_ID}&limit=50`)
      .then((data) => {
        if (!cancelled) setRemoteAuditLog(data)
      })
      .catch((err) => {
        console.warn("[audit-panel] Falha ao buscar trilha de auditoria real, usando simulação local:", err)
      })

    return () => {
      cancelled = true
    }
  }, [status]) // re-busca a cada mudança de status de produção (nova ação de escrita provável)

  const hasRemoteData = remoteAuditLog !== null && remoteAuditLog.length > 0
  const activeProviders = resolveActiveProvider(aiStatus)

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="font-display text-sm font-semibold tracking-tight">Auditoria — 3 Portões</h2>
      </div>
      <p className="mb-4 text-[11px] leading-snug text-muted-foreground">
        A auto-crítica reprova e reescreve até bater o critério. Só então o portão vai para{" "}
        <span className="text-foreground/80">aprovação humana</span> — nenhuma peça avança sem decisão registrada.
      </p>

      {/* Status dos provedores de IA (Fase 2) — GET /api/ai/status, nunca expõe as chaves */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Provedores de IA</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          <ProviderBadge icon={Cpu} capability="Texto" provider={activeProviders.text} />
          <ProviderBadge icon={ImageIcon} capability="Imagem" provider={activeProviders.image} />
          <ProviderBadge icon={Mic} capability="Narração" provider={activeProviders.narration} />
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground/80">
          Verde = provedor pago configurado no servidor. Cinza = rodando no fallback grátis/local — a produção
          nunca para, mesmo sem nenhuma chave configurada.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {AUDIT_GATES.map((gate) => {
          const result = gates[gate.id]
          const gateStatus = result?.status ?? "pending"
          const approved = gateStatus === "approved"
          const rejected = gateStatus === "rejected"
          const awaiting = gateStatus === "auto_pass"
          const settled = approved || rejected

          return (
            <div
              key={gate.id}
              className={cn(
                "rounded-xl border p-3 transition-all",
                approved
                  ? "border-success/30 bg-success/5"
                  : rejected
                    ? "border-destructive/30 bg-destructive/5"
                    : awaiting
                      ? "border-warning/40 bg-warning/5"
                      : "border-border bg-background/40",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    approved
                      ? "bg-success/20 text-success"
                      : rejected
                        ? "bg-destructive/20 text-destructive"
                        : awaiting
                          ? "bg-warning/20 text-warning"
                          : "bg-secondary text-muted-foreground",
                  )}
                >
                  {approved ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : rejected ? (
                    <X className="h-3.5 w-3.5" aria-hidden />
                  ) : awaiting ? (
                    <UserCheck className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                  )}
                </span>
                <span className="flex-1 text-xs font-semibold text-foreground">{gate.name}</span>
                {gateStatus !== "pending" ? (
                  <span
                    className={cn(
                      "font-mono text-xs font-bold",
                      approved ? "text-success" : rejected ? "text-destructive" : "text-warning",
                    )}
                  >
                    {result.score}%
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-muted-foreground">≥ {gate.threshold}%</span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {gate.criteria.map((c) => (
                  <span
                    key={c}
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[10px]",
                      approved
                        ? "border-success/20 bg-success/10 text-success"
                        : "border-border bg-secondary text-muted-foreground/70",
                    )}
                  >
                    {c}
                  </span>
                ))}
              </div>

              {gateStatus !== "pending" && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {result.measured ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                      <Gauge className="h-2.5 w-2.5" aria-hidden />
                      medido de verdade
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                      <FlaskConical className="h-2.5 w-2.5" aria-hidden />
                      simulação
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {result.measured
                      ? `Fidelidade objetiva de "${result.measuredLabel ?? "peça"}" (aba Vídeo).`
                      : "Sem peça real medida para este critério nesta fase."}
                  </span>
                </div>
              )}

              {/* human-in-the-loop: decisão registrada */}
              {awaiting && (
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onDecideGate(gate.id, "approved", REVIEWER)}
                    className="flex-1 rounded-md bg-success px-2 py-1.5 text-[11px] font-semibold text-success-foreground transition-opacity hover:opacity-90"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDecideGate(gate.id, "rejected", REVIEWER)}
                    className="rounded-md border border-destructive/40 px-2 py-1.5 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
                  >
                    Reprovar
                  </button>
                </div>
              )}

              {settled && result.decidedBy && result.decidedAt && (
                <p
                  className={cn(
                    "mt-2 flex items-center gap-1.5 text-[10px]",
                    approved ? "text-success" : "text-destructive",
                  )}
                >
                  <UserCheck className="h-3 w-3" aria-hidden />
                  {approved ? "Aprovado" : "Reprovado"} por {result.decidedBy} · {fmtTime(result.decidedAt)}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Trilha de auditoria — GET /api/v1/audit (audit_logs) quando disponível, senão simulação local */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5">
          <ScrollText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Trilha de auditoria</span>
          {hasRemoteData && (
            <span className="rounded bg-success/15 px-1 py-0.5 font-mono text-[9px] text-success">dados reais</span>
          )}
        </div>
        <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-border bg-background/60 p-2.5">
          {hasRemoteData ? (
            <ul className="flex flex-col gap-1.5">
              {remoteAuditLog!.map((entry) => (
                <li key={entry.id} className="flex items-start gap-2 text-[11px] leading-snug">
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded px-1 py-0.5 font-mono text-[9px]",
                      entry.status_code < 400 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {entry.method}
                  </span>
                  <span className="text-muted-foreground">
                    <span className="text-foreground/80">{entry.route}</span> · {entry.status_code} ·{" "}
                    {entry.actor} · {fmtTime(new Date(entry.created_at).getTime())}
                  </span>
                </li>
              ))}
            </ul>
          ) : auditLog.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-muted-foreground/60">
              {status === "review"
                ? "Aguardando decisão humana nos portões."
                : "As decisões de aprovação ficam registradas aqui."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {auditLog.map((entry) => (
                <li key={entry.id} className="flex items-start gap-2 text-[11px] leading-snug">
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded px-1 py-0.5 font-mono text-[9px]",
                      entry.action === "approved"
                        ? "bg-success/15 text-success"
                        : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {entry.action === "approved" ? "OK" : "NO"}
                  </span>
                  <span className="text-muted-foreground">
                    <span className="text-foreground/80">{entry.gateName}</span> · {entry.score}% ·{" "}
                    {entry.revisions} rev · {entry.reviewer} · {fmtTime(entry.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
