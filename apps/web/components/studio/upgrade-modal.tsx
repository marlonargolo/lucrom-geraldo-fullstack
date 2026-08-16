"use client"

import { useEffect, useRef, useState } from "react"
import { X, Copy, Check, CreditCard, QrCode, Loader2, ExternalLink, PartyPopper, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  startCheckout,
  startOneOffCheckout,
  pollPaymentStatus,
  type CheckoutResult,
  type PaymentStatus,
  type OneOffProductCode,
} from "@/lib/billing/checkout-client"
import type { QuotaInfo } from "@/lib/billing/quota-error"

/** 'PRO' = upgrade de assinatura (comportamento original). 'AVULSO'/'PACOTE5' = compra única de créditos de vídeo. */
export type PurchaseProduct = "PRO" | OneOffProductCode

export interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  /** Chamado quando o pagamento é confirmado — o chamador deve dar refresh() na cota. */
  onUpgraded?: () => void
  quota?: QuotaInfo | null
  /** Qual produto este modal está vendendo. Default 'PRO' (comportamento original de upgrade de assinatura). */
  product?: PurchaseProduct
}

type Stage = "choose" | "loading" | "pix" | "card" | "polling" | "success" | "failed"

const PRO_PRICE_LABEL = "R$ 49,90/mês"

const PRODUCT_COPY: Record<PurchaseProduct, { title: string; summary: string; detail: string; successTitle: string; successBody: string }> = {
  PRO: {
    title: "Upgrade para o plano PRO",
    summary: `Plano PRO — ${PRO_PRICE_LABEL}`,
    detail: "100 gerações de IA por mês, reset imediato ao confirmar.",
    successTitle: "Upgrade confirmado!",
    successBody: "Seu plano agora é PRO, com 100 gerações por mês.",
  },
  AVULSO: {
    title: "Comprar vídeo avulso",
    summary: "1 vídeo avulso — R$ 39,90",
    detail: "1 crédito de vídeo extra, liberado assim que o pagamento é confirmado. Não expira no fim do mês.",
    successTitle: "Compra confirmada!",
    successBody: "1 crédito de vídeo foi adicionado à sua conta.",
  },
  PACOTE5: {
    title: "Comprar pacote de 5 vídeos",
    summary: "Pacote de 5 vídeos (60s) — R$ 179,90",
    detail: "5 créditos de vídeo, liberados assim que o pagamento é confirmado. Não expiram no fim do mês.",
    successTitle: "Compra confirmada!",
    successBody: "5 créditos de vídeo foram adicionados à sua conta.",
  },
}

export function UpgradeModal({ open, onClose, onUpgraded, quota, product = "PRO" }: UpgradeModalProps) {
  const [stage, setStage] = useState<Stage>("choose")
  const [error, setError] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const copy = PRODUCT_COPY[product]

  useEffect(() => {
    if (!open) {
      // reset ao fechar, pra próxima abertura começar do zero
      setStage("choose")
      setError(null)
      setCheckout(null)
      setCopied(false)
      abortRef.current?.abort()
    }
  }, [open])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  if (!open) return null

  const runPolling = (paymentId: string) => {
    abortRef.current = new AbortController()
    setStage("polling")
    pollPaymentStatus(paymentId, { signal: abortRef.current.signal })
      .then((status: PaymentStatus) => {
        if (status === "approved") {
          setStage("success")
          onUpgraded?.()
        } else if (status === "rejected" || status === "refunded") {
          setError("O pagamento não foi aprovado. Tente novamente ou use outro método.")
          setStage("failed")
        } else {
          // ainda pending depois do tempo máximo de espera — não é necessariamente uma falha
          setError("Ainda aguardando confirmação do pagamento. Isso pode levar alguns minutos — feche e confira depois.")
          setStage("failed")
        }
      })
      .catch(() => {
        /* polling cancelado (modal fechado) — nada a fazer */
      })
  }

  const startProductCheckout = (method: "pix" | "card") =>
    product === "PRO" ? startCheckout(method) : startOneOffCheckout(product, method)

  const choosePix = async () => {
    setStage("loading")
    setError(null)
    try {
      const result = await startProductCheckout("pix")
      setCheckout(result)
      setStage("pix")
      if (result.type === "pix") runPolling(result.paymentId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar cobrança PIX.")
      setStage("choose")
    }
  }

  const chooseCard = async () => {
    setStage("loading")
    setError(null)
    try {
      const result = await startProductCheckout("card")
      setCheckout(result)
      setStage("card")
      if (result.type === "card") {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer")
        runPolling(result.paymentId)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar checkout de cartão.")
      setStage("choose")
    }
  }

  const copyPixCode = () => {
    if (checkout?.type !== "pix") return
    navigator.clipboard?.writeText(checkout.qrCodeText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold">{copy.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {quota && stage === "choose" && (
          <p className="mb-3 text-[11px] text-muted-foreground">
            Você usou {quota.used}/{quota.limit} gerações do plano {quota.plan} este mês.
          </p>
        )}

        {stage === "choose" && (
          <>
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-semibold text-foreground">{copy.summary}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{copy.detail}</p>
            </div>
            {error && <p className="mb-3 text-[11px] text-destructive">{error}</p>}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={choosePix}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <QrCode className="h-4 w-4" aria-hidden />
                Pagar com PIX
              </button>
              <button
                type="button"
                onClick={chooseCard}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                <CreditCard className="h-4 w-4" aria-hidden />
                Pagar com cartão
              </button>
            </div>
          </>
        )}

        {stage === "loading" && (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
            <p className="text-[11px] text-muted-foreground">Gerando cobrança...</p>
          </div>
        )}

        {stage === "pix" && checkout?.type === "pix" && (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${checkout.qrCodeBase64}`}
              alt="QR Code PIX"
              className="h-44 w-44 rounded-lg border border-border bg-white p-2"
            />
            <button
              type="button"
              onClick={copyPixCode}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              {copied ? "Copiado!" : "Copiar código PIX"}
            </button>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Aguardando confirmação do pagamento...
            </div>
          </div>
        )}

        {stage === "card" && checkout?.type === "card" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <ExternalLink className="h-6 w-6 text-primary" aria-hidden />
            <p className="text-center text-[11px] text-muted-foreground">
              Abrimos o checkout seguro do Mercado Pago numa nova aba. Complete o pagamento por lá.
            </p>
            <button
              type="button"
              onClick={() => window.open(checkout.checkoutUrl, "_blank", "noopener,noreferrer")}
              className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
            >
              Abrir novamente
            </button>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Aguardando confirmação do pagamento...
            </div>
          </div>
        )}

        {stage === "polling" && (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
            <p className="text-[11px] text-muted-foreground">Confirmando pagamento...</p>
          </div>
        )}

        {stage === "success" && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <PartyPopper className="h-8 w-8 text-success" aria-hidden />
            <p className="text-sm font-semibold text-foreground">{copy.successTitle}</p>
            <p className="text-[11px] text-muted-foreground">{copy.successBody}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Fechar
            </button>
          </div>
        )}

        {stage === "failed" && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <TriangleAlert className="h-6 w-6 text-destructive" aria-hidden />
            <p className={cn("text-[11px] text-muted-foreground")}>{error}</p>
            <button
              type="button"
              onClick={() => {
                setStage("choose")
                setError(null)
              }}
              className="mt-2 rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              Tentar de novo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

