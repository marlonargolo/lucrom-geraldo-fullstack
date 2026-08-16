# Ajustes: 1 vídeo grátis, compra avulsa e pacote de 5 vídeos

## 1. Correção "5 vídeos grátis" → "1 vídeo grátis"

**O código já estava certo, o texto do site é que estava errado.**

- `apps/api/src/usage/usage.service.ts` — `PLAN_QUOTA_LIMITS.CREATOR` já era `1`. O backend
  sempre bloqueou corretamente em 1 geração/mês.
- `apps/web/app/page.tsx` (landing/fanpage) — a constante `PLAN_CREATOR_LIMIT` estava em `5`,
  dessincronizada do backend. Corrigida para `1` e os textos ("5 gerações grátis", "5 gerações
  de IA por mês") ajustados para singular ("1 vídeo grátis", "1 vídeo de IA por mês").

## 2. Módulo de compra avulsa (R$ 9,90/vídeo) e Pacote 5 vídeos 60s (R$ 179,90)

Novo sistema de créditos de vídeo, separado da assinatura mensal (CREATOR/PRO/ENTERPRISE):

- **`apps/api/src/billing/one-off-products.ts`** (novo) — catálogo de preço travado no
  servidor. `amountCents` e `credits` NUNCA vêm do cliente.
- **Migration** `1754300000000-AddOneOffVideoCredits.ts` — adiciona `tenants.extra_video_credits`
  e `payments.product_type` / `payments.credits_granted`.
- **`UsageService.consume()`** — quando a cota mensal do plano esgota, cai automaticamente para
  o saldo de créditos avulsos antes de bloquear (duas UPDATEs atômicas, sem race condition).
- **`UsageService.addCredits()`** (novo) — soma créditos ao tenant após pagamento aprovado.
- **`BillingService`** — `createPendingOneOffPayment()` (novo) e `confirmPayment()` agora
  distingue upgrade de plano de compra avulsa via `product_type`.
- **`BillingController`** — `POST /api/v1/billing/checkout-intents/one-off` (preço resolvido
  no servidor) e `GET /api/v1/billing/products/one-off` (catálogo público).
- **Frontend**: nova rota `app/api/billing/checkout-one-off/route.ts`, `checkout-client.ts`
  ganhou `startOneOffCheckout()`, `UpgradeModal` virou modal genérico de compra (`product`:
  `PRO | AVULSO | PACOTE5`), `QuotaBadge` ganhou botão de upsell "+1 vídeo por R$ 9,90" quando
  a cota esgota, e a landing (`page.tsx`) ganhou os 2 novos cards de preço com CTA
  `/studio?buy=avulso` e `/studio?buy=pacote5` que abrem o modal certo automaticamente.

## Pendente (rodar antes de subir pra produção)

1. `npm install` em `apps/api` e `apps/web` (sem rede neste ambiente, não rodei `tsc`/lint).
2. Rodar a migration nova contra o Postgres real.
3. Testar o fluxo PIX/cartão de ponta a ponta em sandbox do Mercado Pago (mesmo aviso que já
   existia em `mercadopago-client.ts` — nunca testado contra API real neste ambiente).

## Ainda não incluído

Você mencionou que vai mandar, em seguida, as **regras de blindagem** (limite de refações,
timeout, limite de caracteres, System Prompt da IA, etc.) — isso ainda não foi implementado.
Mande as regras/prompt que eu aplico em cima disso.
