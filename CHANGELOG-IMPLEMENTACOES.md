# Integração do pacote `implementacoes.zip`

O zip trazia uma versão Vite/React Router do frontend (`criat-ai-web`) e um
servidor Express de demonstração (`api-server`, com pagamentos em 503 e
projetos em memória). **A stack real foi mantida** (Next.js em `apps/web` +
NestJS em `apps/api`): as telas novas foram convertidas para o App Router e
todo endpoint que elas chamam foi implementado de verdade no NestJS.

## Frontend (`apps/web`)

| Funcionalidade | Onde |
|---|---|
| Central legal (Termos, Privacidade, Cookies) + aviso de cookies | `app/termos`, `app/privacidade`, `app/cookies`, `components/legal/*`, `lib/legal/policies.ts` |
| Aceite obrigatório dos termos no cadastro | `app/studio/login/page.tsx`, `lib/auth/auth-context.tsx` |
| Recuperação de senha (pedido + definir nova senha via `?reset=<token>`) | `app/studio/login/page.tsx` |
| Painel da plataforma `/studio/admin` (só `isPlatformAdmin`) | `app/studio/admin/*`, `lib/admin/admin-client.ts`, `lib/auth/require-platform-admin.tsx` |
| Consumo e créditos `/studio/consumo` | `components/studio/account-panel.tsx` |
| Contas sociais `/studio/contas` | `app/studio/contas/page.tsx` |
| Galeria/editor de peças `/studio/pecas`, formato 1080x1080 | `lib/graphics/piece-library.ts`, `components/studio/piece-editor.tsx`, `components/studio/graphics-lab.tsx` |
| Briefing com otimização por IA + upload de referências | `components/studio/briefing-composer.tsx`, `components/studio/reference-uploader.tsx` |
| Vídeo de referência (além de imagem), criação automática | `components/studio/video-generator.tsx` |
| Plano PLUS e novos preços | `app/page.tsx`, `components/studio/upgrade-modal.tsx`, `quota-badge.tsx` |
| Rebrand visível para Criatai | textos da UI |

Mantido do nosso projeto (não substituído pelo zip): proxy `/api/backend/*`
(API_TOKEN nunca vai para o navegador), checkout via Route Handlers do
Mercado Pago, e as chaves de `localStorage`/IndexedDB (`lucrom:*`) — assim
ninguém é deslogado nem perde consentimentos já gravados.

Novo Route Handler: `app/api/media-assets/upload` — upload multipart
autenticado que força o `tenant_id` do JWT.

## Backend (`apps/api`)

| Endpoint | Descrição |
|---|---|
| `POST /api/v1/auth/register` | agora exige `termsVersion`/`privacyVersion` (gravados em `users`) |
| `POST /api/v1/auth/login` | retorna `user.isPlatformAdmin` |
| `POST /api/v1/auth/forgot-password` / `reset-password` | token de uso único (hash no Redis, 1h); resposta genérica |
| `GET /api/v1/usage/summary` | resumo do ciclo para o painel de consumo |
| `GET /api/v1/billing/history`, `GET /api/v1/billing/products/plans` | histórico do tenant e catálogo de planos |
| `POST /api/v1/billing/checkout-intents` | aceita `PRO`/`PLUS`; **preço resolvido no servidor** (`billing/plan-products.ts`) |
| `GET /api/v1/admin/overview` / `activity` / `risk-alerts` | métricas reais; `PlatformAdminGuard` consulta `users.is_platform_admin` |
| `POST /api/v1/ai/prompt-optimize` / `generations` | DeepSeek (`LlmClientService`) com cache Redis e fallback local; geração pelo `AiOrchestratorService` (debita/estorna cota) |

Planos: CREATOR 3/mês, PRO 5/mês (R$ 119), PLUS 15/mês (R$ 329), avulso
R$ 29,90, pacote 5 vídeos R$ 134,90.

Migração `1754500000000-AddLegalAcceptanceAndPlatformAdmin`. As migrações
`1754300000000` e `1754400000000` já existiam mas não estavam registradas em
`database.module.ts` — agora estão (são idempotentes).

Promover um admin da plataforma:

```sql
UPDATE users SET is_platform_admin = true WHERE email = 'voce@empresa.com';
```

## Pendências conhecidas

- **E-mail de recuperação de senha:** não há provedor de e-mail no backend.
  Fora de produção o link aparece no log da API; em produção só um aviso é
  logado. Plugar o envio em `AuthService.deliverResetLink`.
- **Marca d'água no plano grátis:** anunciada na landing, ainda não aplicada
  na renderização.
- **Contas sociais:** a tela é informativa; a conexão OAuth ainda não existe.
