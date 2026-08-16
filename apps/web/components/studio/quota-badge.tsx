"use client"

import { Zap, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import type { QuotaPeek } from "@/lib/usage/quota-client"

export interface QuotaBadgeProps {
  quota: QuotaPeek | null
  loading?: boolean
  loggedIn: boolean
  /** Sem página de checkout ainda — por padrão abre um e-mail de contato. */
  onUpgradeClick?: () => void
  /** Upsell de compra avulsa (1 vídeo, R$ 39,90) quando a cota do mês esgota. */
  onBuyOneOffClick?: () => void
  className?: string
}

const DEFAULT_UPGRADE_EMAIL = "mailto:vendas@lucrom.studio?subject=Upgrade%20de%20plano%20-%20Lucrom%20Studio"

/**
 * Badge discreto de cota mensal de IA. Não renderiza nada se: deslogado,
 * ainda carregando sem dado anterior, ou a consulta falhou (fetchQuota()
 * retorna null) — o gate de verdade continua sendo o 402 de
 * /api/ai/generate-ad; este componente é só um indicador, sua ausência
 * nunca bloqueia nada.
 */
export function QuotaBadge({ quota, loading, loggedIn, onUpgradeClick, onBuyOneOffClick, className }: QuotaBadgeProps) {
  if (!loggedIn) return null
  if (!quota) {
    if (!loading) return null
    return (
      <div className={cn("h-8 w-40 animate-pulse rounded-lg bg-secondary/60", className)} aria-hidden />
    )
  }

  if (quota.plan === "ENTERPRISE") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/5 px-2.5 py-1.5 text-[11px] font-medium text-success",
          className,
        )}
      >
        <Zap className="h-3.5 w-3.5" aria-hidden />
        Plano Enterprise · Ilimitado
      </div>
    )
  }

  const pct = quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0
  const exhausted = !quota.allowed

  return (
    <div className={cn("w-full max-w-xs", className)}>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className={cn("font-medium", exhausted ? "text-destructive" : "text-muted-foreground")}>
          {quota.used}/{quota.limit} gerações usadas este mês
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{quota.plan}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            exhausted ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {exhausted && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-2">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
            <p className="flex-1 text-[11px] leading-snug text-destructive">
              {quota.extraCreditsRemaining
                ? `Vídeo grátis do mês esgotado. Você ainda tem ${quota.extraCreditsRemaining} crédito(s) avulso(s).`
                : "Seu vídeo grátis do mês esgotou."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBuyOneOffClick ?? (() => window.open(DEFAULT_UPGRADE_EMAIL, "_blank"))}
              className="flex-1 rounded-md border border-primary/40 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/5"
            >
              +1 vídeo por R$ 39,90
            </button>
            <button
              type="button"
              onClick={onUpgradeClick ?? (() => window.open(DEFAULT_UPGRADE_EMAIL, "_blank"))}
              className="flex-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:opacity-90"
            >
              Fazer upgrade
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
