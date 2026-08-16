// Cliente server-side do Mercado Pago — escolhido por ser o gateway mais
// consolidado e documentado para o mercado brasileiro com suporte nativo a
// PIX. A arquitetura é a mesma já estabelecida em lib/ai-services.ts: um
// único provedor "de verdade" implementado com cuidado, em vez de três
// integrações incompletas (Asaas/Stripe ficam como extensão futura óbvia,
// mesma forma — ver comentário no fim do arquivo).
//
// SEGURANÇA: MERCADOPAGO_ACCESS_TOKEN e MERCADOPAGO_WEBHOOK_SECRET são lidos
// via process.env SEM prefixo NEXT_PUBLIC_, então nunca chegam ao bundle do
// navegador — mesmo padrão de lib/ai-services.ts.
//
// AVISO DE HONESTIDADE: os formatos de request/response abaixo (PIX,
// Checkout Pro, verificação de assinatura de webhook) seguem a documentação
// pública do Mercado Pago da forma mais fiel que eu conhecia no momento de
// escrever isso — mas eu NÃO consegui testar contra os servidores reais do
// Mercado Pago neste ambiente (rede do sandbox não alcança api.mercadopago.com).
// Antes de ir pra produção, valide pelo menos uma vez: (1) uma cobrança PIX
// real de baixo valor, (2) uma notificação de webhook real do ambiente de
// sandbox do Mercado Pago, comparando os campos que chegam com o que este
// arquivo espera.

import { createHmac, timingSafeEqual } from "crypto"

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN ?? ""
const WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? ""
const API_BASE = "https://api.mercadopago.com"

export function isMercadoPagoConfigured(): boolean {
  return Boolean(ACCESS_TOKEN)
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
}

async function mpFetch<T>(path: string, init: RequestInit & { idempotencyKey?: string }): Promise<T> {
  if (!ACCESS_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado neste servidor.")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  }
  const res = (await Promise.race([
    fetch(`${API_BASE}${path}`, { ...init, headers },),
    timeout(20000),
  ])) as Response
  const data = await res.json()
  if (!res.ok) {
    throw new Error(`Mercado Pago respondeu ${res.status}: ${JSON.stringify(data)}`)
  }
  return data as T
}

// =============================================================================
// PIX — Payments API (cobrança direta, retorna QR Code na hora)
// =============================================================================

export interface CreatePixPaymentParams {
  amountCents: number
  description: string
  externalReference: string
  payerEmail: string
  notificationUrl: string
}

export interface PixPaymentResult {
  id: string
  status: string
  qrCodeBase64: string
  qrCodeText: string
}

export async function createPixPayment(params: CreatePixPaymentParams): Promise<PixPaymentResult> {
  const data = await mpFetch<{
    id: number
    status: string
    point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } }
  }>("/v1/payments", {
    method: "POST",
    idempotencyKey: params.externalReference,
    body: JSON.stringify({
      transaction_amount: params.amountCents / 100,
      description: params.description,
      payment_method_id: "pix",
      payer: { email: params.payerEmail },
      external_reference: params.externalReference,
      notification_url: params.notificationUrl,
    }),
  })

  const qrCodeBase64 = data.point_of_interaction?.transaction_data?.qr_code_base64
  const qrCodeText = data.point_of_interaction?.transaction_data?.qr_code
  if (!qrCodeBase64 || !qrCodeText) {
    throw new Error("Mercado Pago não retornou os dados do QR Code PIX esperados.")
  }

  return { id: String(data.id), status: data.status, qrCodeBase64, qrCodeText }
}

// =============================================================================
// CARTÃO — Checkout Pro (redirect hospedado pelo Mercado Pago)
// =============================================================================
// Escolhido em vez da Checkout API (tokenização client-side) de propósito:
// Checkout Pro nunca expõe este servidor a dados de cartão (o Mercado Pago
// hospeda o formulário inteiro), o que evita qualquer responsabilidade de
// compliance PCI-DSS do nosso lado. Tokenização client-side (MP.js) é mais
// "integrada" visualmente, mas exige tratamento de dados de cartão com muito
// mais cuidado — não é o corte certo pra um MVP.

export interface CreateCardCheckoutParams {
  amountCents: number
  description: string
  externalReference: string
  notificationUrl: string
  backUrls: { success: string; failure: string; pending: string }
}

export interface CardCheckoutResult {
  id: string
  checkoutUrl: string
}

export async function createCardCheckout(params: CreateCardCheckoutParams): Promise<CardCheckoutResult> {
  const data = await mpFetch<{ id: string; init_point?: string; sandbox_init_point?: string }>(
    "/checkout/preferences",
    {
      method: "POST",
      idempotencyKey: params.externalReference,
      body: JSON.stringify({
        items: [
          {
            title: params.description,
            quantity: 1,
            unit_price: params.amountCents / 100,
            currency_id: "BRL",
          },
        ],
        external_reference: params.externalReference,
        notification_url: params.notificationUrl,
        back_urls: params.backUrls,
        auto_return: "approved",
      }),
    },
  )

  const checkoutUrl = data.init_point || data.sandbox_init_point
  if (!checkoutUrl) throw new Error("Mercado Pago não retornou uma URL de checkout.")

  return { id: data.id, checkoutUrl }
}

// =============================================================================
// Consulta de pagamento — usado pelo webhook pra revalidar o status
// direto na fonte, nunca confiando só no corpo da notificação recebida.
// =============================================================================

export interface MercadoPagoPayment {
  id: string
  status: string // "approved" | "rejected" | "pending" | "refunded" | ...
  external_reference: string | null
}

export async function getPayment(paymentId: string): Promise<MercadoPagoPayment> {
  const data = await mpFetch<{ id: number; status: string; external_reference: string | null }>(
    `/v1/payments/${paymentId}`,
    { method: "GET" },
  )
  return { id: String(data.id), status: data.status, external_reference: data.external_reference }
}

// =============================================================================
// Verificação de assinatura do webhook
// =============================================================================
// Formato documentado pelo Mercado Pago (webhooks v2): o header
// `x-signature` vem como "ts=<timestamp>,v1=<hmac_hex>". O HMAC-SHA256 é
// calculado sobre um "manifest" no formato:
//   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
// usando o segredo configurado no painel do Mercado Pago
// (Notificações > Webhooks > Chave secreta). `dataId` deve ser o mesmo
// valor usado na notificação (query string `data.id` ou corpo `data.id`,
// em minúsculas quando aplicável).
export function verifyWebhookSignature(params: {
  xSignatureHeader: string | null
  xRequestId: string | null
  dataId: string
}): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("[mercadopago-client] MERCADOPAGO_WEBHOOK_SECRET não configurado — rejeitando webhook por segurança.")
    return false
  }
  if (!params.xSignatureHeader || !params.xRequestId) return false

  const parts = Object.fromEntries(
    params.xSignatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=")
      return [k?.trim(), v?.trim()]
    }),
  )
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  const manifest = `id:${params.dataId};request-id:${params.xRequestId};ts:${ts};`
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(manifest).digest("hex")

  const expectedBuf = Buffer.from(expected, "hex")
  const providedBuf = Buffer.from(v1, "hex")
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}

// Extensão futura: Asaas (também focado no mercado nacional, também com
// PIX nativo) ou Stripe (internacional) podem ser adicionados seguindo a
// MESMA forma — um arquivo `lib/billing/asaas-client.ts` com a mesma
// assinatura de funções (createPixPayment/createCardCheckout/getPayment/
// verifyWebhookSignature), e as Route Handlers escolhendo o provedor por
// env var, exatamente como lib/ai-services.ts faz entre Gemini/DeepSeek.
