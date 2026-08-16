// POST /api/billing/checkout-one-off
//
// Equivalente a app/api/billing/checkout/route.ts, mas para os produtos de
// COMPRA ÚNICA (fora da assinatura mensal):
//   - AVULSO: 1 vídeo de 60s — R$ 39,90
//   - PACOTE5: 5 vídeos de 60s — R$ 179,90
//
// BLINDAGEM FINANCEIRA: o preço cobrado NUNCA vem do corpo desta
// requisição. Esta rota só repassa `productCode` para o backend NestJS
// (POST /api/v1/billing/checkout-intents/one-off), que resolve o valor a
// partir de ONE_OFF_PRODUCTS (apps/api/src/billing/one-off-products.ts) —
// a única fonte de verdade de preço. Mesmo que alguém edite o payload
// desta rota no DevTools, o valor cobrado no Mercado Pago é sempre o do
// catálogo do servidor.
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createPixPayment, createCardCheckout, isMercadoPagoConfigured } from "@/lib/billing/mercadopago-client"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
const API_TOKEN = process.env.API_TOKEN || ""
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL ?? "").replace(/\/$/, "")

type OneOffProductCode = "AVULSO" | "PACOTE5"

// Só para o texto exibido no PIX/Checkout Pro — o valor cobrado de verdade
// vem da resposta do backend (backendIntent.amount_cents), nunca daqui.
const PRODUCT_LABELS: Record<OneOffProductCode, string> = {
  AVULSO: "Lucrom Studio - Vídeo avulso (1 vídeo 60s)",
  PACOTE5: "Lucrom Studio - Pacote de 5 vídeos (60s)",
}

interface CheckoutBody {
  productCode?: unknown
  method?: unknown
}

interface BackendOneOffPayment {
  id: string
  amount_cents: number
}

async function createBackendOneOffIntent(
  userToken: string,
  productCode: OneOffProductCode,
  method: "pix" | "card",
): Promise<{ ok: true; payment: BackendOneOffPayment } | { ok: false; response: NextResponse }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/billing/checkout-intents/one-off`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Token": userToken },
      body: JSON.stringify({ productCode, method }),
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
        response: NextResponse.json({ error: "Não foi possível iniciar a compra. Tente novamente." }, { status: 502 }),
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
    console.error("[api/billing/checkout-one-off] falha ao anexar external_id ao pagamento", paymentId, err)
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

  const productCode = body.productCode === "AVULSO" || body.productCode === "PACOTE5" ? body.productCode : null
  if (!productCode) {
    return NextResponse.json({ error: "Campo 'productCode' precisa ser 'AVULSO' ou 'PACOTE5'." }, { status: 400 })
  }

  const method = body.method === "pix" || body.method === "card" ? body.method : null
  if (!method) {
    return NextResponse.json({ error: "Campo 'method' precisa ser 'pix' ou 'card'." }, { status: 400 })
  }

  const userToken = req.headers.get("x-user-token") ?? ""
  const intent = await createBackendOneOffIntent(userToken, productCode, method)
  if (!intent.ok) return intent.response

  // Preço vem SEMPRE da resposta do backend (já resolvido a partir do
  // catálogo server-side), nunca de uma constante local recalculada aqui.
  const amountCents = intent.payment.amount_cents
  const description = PRODUCT_LABELS[productCode]
  const notificationUrl = `${PUBLIC_SITE_URL}/api/billing/webhook`

  try {
    if (method === "pix") {
      const pix = await createPixPayment({
        amountCents,
        description,
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
      amountCents,
      description,
      externalReference: intent.payment.id,
      notificationUrl,
      backUrls: {
        success: `${PUBLIC_SITE_URL}/studio?purchase=success`,
        failure: `${PUBLIC_SITE_URL}/studio?purchase=failure`,
        pending: `${PUBLIC_SITE_URL}/studio?purchase=pending`,
      },
    })
    await attachExternalId(intent.payment.id, card.id)
    return NextResponse.json({ type: "card", paymentId: intent.payment.id, checkoutUrl: card.checkoutUrl }, { status: 200 })
  } catch (err) {
    console.error("[api/billing/checkout-one-off] falha ao criar cobrança no Mercado Pago:", err)
    return NextResponse.json({ error: "Não foi possível gerar a cobrança. Tente novamente." }, { status: 502 })
  }
}
