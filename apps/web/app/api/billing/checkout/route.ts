// POST /api/billing/checkout
//
// Etapa 1 do fluxo de upgrade: cria a intenção de pagamento no backend
// (POST /api/v1/billing/checkout-intents — gera um `paymentId` nosso, usado
// como `external_reference` no Mercado Pago) e então chama o Mercado Pago
// pra gerar a cobrança de verdade (PIX com QR Code na hora, ou link de
// Checkout Pro pra cartão).
//
// Requer autenticação (X-User-Token) — mesma proteção das rotas de IA.
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createPixPayment, createCardCheckout, isMercadoPagoConfigured } from "@/lib/billing/mercadopago-client"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
// Correção pós-auditoria (Isolamento de Tenants): sem fallback pra
// NEXT_PUBLIC_API_TOKEN — ver lib/api/client.ts pro caso real que isso
// causou (token do ApiTokenGuard exposto no bundle do navegador).
const API_TOKEN = process.env.API_TOKEN || ""
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL ?? "").replace(/\/$/, "")

// Preço do plano PRO em centavos — configurável, com um default razoável (R$ 49,90/mês).
const PRO_PLAN_PRICE_CENTS = Number(process.env.BILLING_PRO_PLAN_PRICE_CENTS) || 4990

interface CheckoutBody {
  method?: unknown
}

interface BackendPayment {
  id: string
}

async function createBackendIntent(
  userToken: string,
  method: "pix" | "card",
): Promise<{ ok: true; payment: BackendPayment } | { ok: false; response: NextResponse }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/billing/checkout-intents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Token": userToken },
      body: JSON.stringify({ plan: "PRO", method, amountCents: PRO_PLAN_PRICE_CENTS }),
    })
    if (res.status === 401) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Sessão inválida ou expirada. Faça login novamente." }, { status: 401 }),
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Não foi possível iniciar o checkout. Tente novamente." }, { status: 502 }),
      }
    }
    return { ok: true, payment: await res.json() }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Backend de pagamentos indisponível no momento." }, { status: 503 }),
    }
  }
}

async function attachExternalId(paymentId: string, externalId: string): Promise<void> {
  if (!API_TOKEN) return
  try {
    await fetch(`${API_BASE_URL}/api/v1/billing/checkout-intents/${paymentId}/external-id`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_TOKEN}` },
      body: JSON.stringify({ externalId }),
    })
  } catch (err) {
    // Não-fatal pro checkout em si (o pagamento já foi criado no Mercado Pago) —
    // mas sem isso o webhook não vai achar external_id salvo; loga alto.
    console.error("[api/billing/checkout] falha ao anexar external_id ao pagamento", paymentId, err)
  }
}

export async function POST(req: NextRequest) {
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json(
      { error: "Pagamentos não configurados neste servidor (MERCADOPAGO_ACCESS_TOKEN ausente)." },
      { status: 501 },
    )
  }
  if (!API_BASE_URL) {
    return NextResponse.json({ error: "Backend não configurado neste servidor." }, { status: 501 })
  }

  const auth = requireUser(req)
  if (!auth.ok) return auth.response

  let body: CheckoutBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 })
  }

  const method = body.method === "pix" || body.method === "card" ? body.method : null
  if (!method) {
    return NextResponse.json({ error: "Campo 'method' precisa ser 'pix' ou 'card'." }, { status: 400 })
  }

  const userToken = req.headers.get("x-user-token") ?? ""
  const intent = await createBackendIntent(userToken, method)
  if (!intent.ok) return intent.response

  const notificationUrl = `${PUBLIC_SITE_URL}/api/billing/webhook`

  try {
    if (method === "pix") {
      const pix = await createPixPayment({
        amountCents: PRO_PLAN_PRICE_CENTS,
        description: "Lucrom Studio - Plano PRO (mensal)",
        externalReference: intent.payment.id,
        payerEmail: auth.user.email,
        notificationUrl,
      })
      await attachExternalId(intent.payment.id, pix.id)
      return NextResponse.json(
        {
          type: "pix",
          paymentId: intent.payment.id,
          qrCodeBase64: pix.qrCodeBase64,
          qrCodeText: pix.qrCodeText,
        },
        { status: 200 },
      )
    }

    const card = await createCardCheckout({
      amountCents: PRO_PLAN_PRICE_CENTS,
      description: "Lucrom Studio - Plano PRO (mensal)",
      externalReference: intent.payment.id,
      notificationUrl,
      backUrls: {
        success: `${PUBLIC_SITE_URL}/?upgrade=success`,
        failure: `${PUBLIC_SITE_URL}/?upgrade=failure`,
        pending: `${PUBLIC_SITE_URL}/?upgrade=pending`,
      },
    })
    await attachExternalId(intent.payment.id, card.id)
    return NextResponse.json({ type: "card", paymentId: intent.payment.id, checkoutUrl: card.checkoutUrl }, { status: 200 })
  } catch (err) {
    console.error("[api/billing/checkout] falha ao criar cobrança no Mercado Pago:", err)
    return NextResponse.json({ error: "Não foi possível gerar a cobrança. Tente novamente." }, { status: 502 })
  }
}
