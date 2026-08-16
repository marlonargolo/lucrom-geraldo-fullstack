"use client"

import { getSession } from "@/lib/auth/session-store"
import { apiFetch } from "@/lib/api/client"

export type CheckoutResult =
  | { type: "pix"; paymentId: string; qrCodeBase64: string; qrCodeText: string }
  | { type: "card"; paymentId: string; checkoutUrl: string }

export type PaymentStatus = "pending" | "approved" | "rejected" | "refunded"

/** Chama POST /api/billing/checkout (Route Handler, apps/web) — cria a cobrança PIX ou o link de Checkout Pro. */
export async function startCheckout(method: "pix" | "card"): Promise<CheckoutResult> {
  const session = getSession()
  if (!session) throw new Error("Faça login para fazer upgrade de plano.")

  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Token": session.accessToken },
    body: JSON.stringify({ method }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error || `Falha ao iniciar checkout (HTTP ${res.status}).`)
  }
  return data as CheckoutResult
}

export type OneOffProductCode = "AVULSO" | "PACOTE5"

/**
 * Chama POST /api/billing/checkout-one-off — cria a cobrança PIX ou o link
 * de Checkout Pro para a compra avulsa de 1 vídeo (AVULSO) ou do pacote de
 * 5 vídeos (PACOTE5). Preço é sempre resolvido no backend a partir do
 * catálogo server-side (ver apps/api/src/billing/one-off-products.ts) —
 * este helper nunca envia valor, só o código do produto.
 */
export async function startOneOffCheckout(productCode: OneOffProductCode, method: "pix" | "card"): Promise<CheckoutResult> {
  const session = getSession()
  if (!session) throw new Error("Faça login para comprar.")

  const res = await fetch("/api/billing/checkout-one-off", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Token": session.accessToken },
    body: JSON.stringify({ productCode, method }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error || `Falha ao iniciar a compra (HTTP ${res.status}).`)
  }
  return data as CheckoutResult
}

/** Consulta o status do pagamento direto no backend (GET /api/v1/billing/checkout-intents/:id). */
export async function getPaymentStatus(paymentId: string): Promise<{ status: PaymentStatus }> {
  return apiFetch<{ status: PaymentStatus }>(`/api/v1/billing/checkout-intents/${paymentId}`)
}

/**
 * Faz polling do status do pagamento até ele sair de 'pending' ou o tempo
 * máximo esgotar. Usado pelo modal de upgrade pra saber quando fechar e
 * comemorar (ou avisar que falhou), sem exigir que o usuário atualize a
 * página depois de pagar.
 */
export function pollPaymentStatus(
  paymentId: string,
  opts: { intervalMs?: number; maxAttempts?: number; onUpdate?: (status: PaymentStatus) => void; signal?: AbortSignal },
): Promise<PaymentStatus> {
  const intervalMs = opts.intervalMs ?? 3000
  const maxAttempts = opts.maxAttempts ?? 100 // ~5min no default

  return new Promise((resolve, reject) => {
    let attempts = 0
    const tick = async () => {
      if (opts.signal?.aborted) {
        reject(new Error("cancelado"))
        return
      }
      attempts++
      try {
        const { status } = await getPaymentStatus(paymentId)
        opts.onUpdate?.(status)
        if (status !== "pending") {
          resolve(status)
          return
        }
      } catch {
        /* erro pontual de rede — só tenta de novo no próximo tick */
      }
      if (attempts >= maxAttempts) {
        resolve("pending") // desiste de esperar, mas não é um erro — o pagamento pode confirmar depois
        return
      }
      setTimeout(tick, intervalMs)
    }
    tick()
  })
}
