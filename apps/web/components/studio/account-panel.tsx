"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api/client"
import { getSession } from "@/lib/auth/session-store"
import { cn } from "@/lib/utils"
import { UpgradeModal, type PurchaseProduct } from "./upgrade-modal"

type Summary = {
  used: number
  limit: number
  plan: string
  remaining: number
  extraCreditsRemaining?: number
  periodEnd: string
  accessStatus: "active" | "exhausted"
}
type Product = { code: string; label: string; credits: number; amountCents: number }
type Payment = { id: string; product_type: string; amount_cents: number; status: string; created_at: string }

export function AccountPanel() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [purchaseProduct, setPurchaseProduct] = useState<PurchaseProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const session = getSession()
  const sessionToken = session?.accessToken

  useEffect(() => {
    if (!sessionToken) {
      setLoading(false)
      return
    }
    Promise.allSettled([
      apiFetch<Summary>("/api/v1/usage/summary"),
      apiFetch<Product[]>("/api/v1/billing/products/one-off"),
      apiFetch<Payment[]>("/api/v1/billing/history"),
    ])
      .then(([usageResult, catalogResult, historyResult]) => {
        if (usageResult.status === "fulfilled") setSummary(usageResult.value)
        if (catalogResult.status === "fulfilled") setProducts(catalogResult.value)
        if (historyResult.status === "fulfilled") setPayments(historyResult.value)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [sessionToken])

  if (!session) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        Entre na sua conta para consultar o consumo.
      </section>
    )
  }
  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Carregando sua gestão de consumo...
      </section>
    )
  }
  if (!summary) {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Não foi possível carregar os dados de consumo.
      </section>
    )
  }

  const pct = Math.min(100, Math.round((summary.used / Math.max(summary.limit, 1)) * 100))
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[11px] uppercase tracking-widest text-primary">Gestão da conta</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Consumo e créditos</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Acompanhe validade, saldo e uso da API em um só lugar.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Plano atual" value={summary.plan} detail={`${summary.used}/${summary.limit} gerações no mês`} />
        <Metric label="Saldo disponível" value={String(summary.remaining)} detail="unidades para gerar" />
        <Metric label="Créditos avulsos" value={String(summary.extraCreditsRemaining ?? 0)} detail="não expiram" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span>Uso mensal da API</span>
          <span className="font-mono text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              summary.accessStatus === "exhausted" ? "bg-destructive" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Ciclo válido até {new Date(summary.periodEnd).toLocaleDateString("pt-BR")}. Compras avulsas são adicionadas ao saldo após a aprovação do pagamento.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Comprar unidades</h2>
          <span className="text-xs text-muted-foreground">Preço definido pelo servidor</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map((product) => (
            <div key={product.code} className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="font-medium">{product.label}</p>
                <p className="text-xs text-muted-foreground">{product.credits} unidade(s)</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm">R$ {(product.amountCents / 100).toFixed(2).replace(".", ",")}</span>
                <button
                  type="button"
                  onClick={() => setPurchaseProduct(product.code as "AVULSO" | "PACOTE5")}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Comprar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4">
          <h2 className="font-semibold">Escolha seu plano</h2>
          <p className="mt-1 text-xs text-muted-foreground">Pague com Pix ou cartão pelo checkout seguro do Mercado Pago.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <PlanCard
            name="PRO"
            price="R$ 119/mês"
            detail="5 gerações de IA por mês"
            onClick={() => setPurchaseProduct("PRO")}
          />
          <PlanCard
            name="PLUS"
            price="R$ 329/mês"
            detail="15 gerações de IA por mês"
            onClick={() => setPurchaseProduct("PLUS")}
          />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">Histórico de pagamentos</h2>
        <div className="flex flex-col gap-3">
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma compra registrada.</p>
          ) : (
            payments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between border-b border-border pb-3 text-sm last:border-0">
                <span>{payment.product_type} · {new Date(payment.created_at).toLocaleDateString("pt-BR")}</span>
                <span className="font-mono">R$ {(payment.amount_cents / 100).toFixed(2).replace(".", ",")} · {payment.status}</span>
              </div>
            ))
          )}
        </div>
      </div>
      <UpgradeModal
        open={purchaseProduct !== null}
        product={purchaseProduct ?? undefined}
        onClose={() => setPurchaseProduct(null)}
        onUpgraded={() => {
          setPurchaseProduct(null)
          window.location.reload()
        }}
      />
    </section>
  )
}

function PlanCard({
  name,
  price,
  detail,
  onClick,
}: {
  name: "PRO" | "PLUS"
  price: string
  detail: string
  onClick: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div>
        <p className="font-display text-lg font-bold">{name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        <p className="mt-2 font-mono text-sm font-semibold">{price}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Assinar
      </button>
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}