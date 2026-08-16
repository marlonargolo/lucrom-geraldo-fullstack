// POST /api/billing/webhook
//
// Recebe notificações do Mercado Pago (formato "webhooks v2": query string
// `?data.id=<payment_id>&type=payment` ou corpo `{type, data:{id}}`).
//
// Fluxo de segurança (nunca pule nenhuma etapa):
//   1. Verifica a assinatura (header x-signature/x-request-id) — rejeita
//      qualquer notificação que não venha realmente do Mercado Pago.
//   2. Re-busca o pagamento DIRETO na API do Mercado Pago usando o ID
//      recebido — NUNCA confia no `status` que vier no corpo da notificação
//      (poderia ser forjado mesmo com assinatura válida de uma notificação
//      antiga/generic; a fonte de verdade é sempre uma consulta ativa).
//   3. Confirma no backend (POST /api/v1/billing/webhook/confirm), que é
//      IDEMPOTENTE — reenvios do Mercado Pago (comuns, eles reenviam até
//      terem um 2xx) nunca promovem o tenant duas vezes.
//
// Sempre responde rápido: 200 mesmo quando a notificação é ignorada (ex.:
// não é do tipo "payment", ou o pagamento ainda está pending) — só 401 pra
// assinatura inválida e 400 pra payload malformado. Retornar erro genérico
// pra tudo faria o Mercado Pago reenviar infinitamente notificações válidas
// que só não geraram ação (ex.: pagamento pendente).
export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { getPayment, verifyWebhookSignature } from "@/lib/billing/mercadopago-client"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
// Correção pós-auditoria (Isolamento de Tenants): sem fallback pra
// NEXT_PUBLIC_API_TOKEN — ver lib/api/client.ts pro caso real que isso
// causou (token do ApiTokenGuard exposto no bundle do navegador).
const API_TOKEN = process.env.API_TOKEN || ""

function mapMpStatus(mpStatus: string): "approved" | "rejected" | "refunded" | null {
  if (mpStatus === "approved") return "approved"
  if (mpStatus === "rejected" || mpStatus === "cancelled") return "rejected"
  if (mpStatus === "refunded" || mpStatus === "charged_back") return "refunded"
  return null // pending, in_process, etc. — nada a fazer ainda, não é status final
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // Mercado Pago às vezes manda notificação só via query string, sem corpo — não é erro.
  }

  const dataId =
    req.nextUrl.searchParams.get("data.id") ||
    (body.data as { id?: string } | undefined)?.id ||
    (typeof body.id === "string" || typeof body.id === "number" ? String(body.id) : null)
  const type = req.nextUrl.searchParams.get("type") || (body.type as string | undefined)

  if (!dataId) {
    // Notificação sem ID de pagamento — nada a processar, mas não é um erro nosso.
    return NextResponse.json({ received: true, ignored: "sem data.id" }, { status: 200 })
  }

  const signatureValid = verifyWebhookSignature({
    xSignatureHeader: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId,
  })
  if (!signatureValid) {
    console.warn("[api/billing/webhook] assinatura inválida, notificação rejeitada. dataId=", dataId)
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 })
  }

  if (type && type !== "payment") {
    return NextResponse.json({ received: true, ignored: `tipo '${type}' não tratado` }, { status: 200 })
  }

  let payment: Awaited<ReturnType<typeof getPayment>>
  try {
    payment = await getPayment(dataId)
  } catch (err) {
    console.error("[api/billing/webhook] falha ao buscar pagamento no Mercado Pago:", err)
    return NextResponse.json({ error: "Falha ao consultar o pagamento." }, { status: 502 })
  }

  const status = mapMpStatus(payment.status)
  if (!status) {
    // Pending/in_process — nada a fazer ainda, mas confirmamos recebimento
    // pra Meta/Mercado Pago não ficar reenviando a mesma notificação.
    return NextResponse.json({ received: true, status: payment.status }, { status: 200 })
  }

  if (!payment.external_reference) {
    console.error("[api/billing/webhook] pagamento sem external_reference, não sei a qual tenant pertence:", payment.id)
    return NextResponse.json({ received: true, ignored: "sem external_reference" }, { status: 200 })
  }

  if (!API_BASE_URL || !API_TOKEN) {
    console.error("[api/billing/webhook] backend não configurado — não foi possível confirmar o pagamento", payment.id)
    return NextResponse.json({ error: "Backend não configurado." }, { status: 503 })
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/billing/webhook/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_TOKEN}` },
      body: JSON.stringify({ paymentId: payment.external_reference, externalId: payment.id, status }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      console.error("[api/billing/webhook] backend rejeitou a confirmação:", res.status, data)
      return NextResponse.json({ error: "Falha ao confirmar no backend." }, { status: 502 })
    }
    return NextResponse.json({ received: true, upgraded: Boolean(data?.upgraded) }, { status: 200 })
  } catch (err) {
    console.error("[api/billing/webhook] falha de rede ao confirmar no backend:", err)
    return NextResponse.json({ error: "Backend indisponível." }, { status: 503 })
  }
}
