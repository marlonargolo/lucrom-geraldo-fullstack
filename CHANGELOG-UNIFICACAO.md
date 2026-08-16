# Unificação LUCROM Studio AI — Auth + Usage + Brand

Base (matriz, usada fielmente): `lucrom-studio.zip`.
Mesclado nesta entrega: `lucrom-studio-e2e-bugfixes.zip` (usage.service.ts,
brand.module.ts) + Auth portado de `analise-de-escalabilidade-fase0-1.zip`.
`edicao-de-codigo__1_.zip` não continha nada aproveitável (scaffold vazio).

## Novo: módulo `auth/` (Fase 1 — cadastro/login real)

Não existia na matriz. Portado de `analise-de-escalabilidade/lib/auth/*`
(Next.js API Routes) para NestJS/TypeORM, que por sua vez citava ter sido
portado de um projeto `auditoria-de-codigo` não incluído em nenhum pacote
recebido — reconstruído a partir da versão Next.js como referência funcional,
conforme confirmado por você.

- `POST /api/v1/auth/register`: auto-cadastro — cria Tenant (CREATOR) + User
  (ADMIN) numa única transação. **Diferença intencional** da versão-fonte:
  lá `register()` exigia um `tenant_id` já existente; aqui não, porque o
  próprio comentário do `usage.service.ts` da matriz already dizia "CREATOR é
  o plano de entrada (auto-cadastro, ver AuthService.register)" — o fluxo
  principal do produto é auto-cadastro de MEI, não convite pra tenant
  existente.
- `POST /api/v1/auth/login`: bcrypt (12 rounds), rate limit de 5
  tentativas/15min via Redis (atômico, correto com múltiplas réplicas),
  mensagem de erro idêntica pra "e-mail não existe" e "senha errada"
  (anti-enumeração).
- `JwtAuthGuard`: exatamente o guard que `brand.module.ts` já esperava
  (`JwtService` fornecido por `AuthModule`).
- Novo: `common/redis/redis.service.ts` — client Redis genérico (Provider
  NestJS), reaproveita `redis.host`/`redis.port` já existentes.
- `configuration.ts`: adicionado `jwt.expiresIn` (só existia `jwt.secret`).
- `JWT_SECRET` no `.env.example` passou de opcional (só enriquecia auditoria)
  para **obrigatório** (agora assina sessão de verdade).

## Corrigido: módulo `usage/` (Controle de Cotas)

Copiado fielmente do zip de bugfixes, sem alteração. Faltavam:
- Colunas `monthly_ai_generations`/`usage_period_start` em `tenants`
  (adicionadas na entity + migration).
- `UsageController` (`GET /api/v1/usage/:tenantId`) e `UsageModule` —
  só o service existia, não estava exposto nem plugado no `AppModule`.

## Completado: módulo `brand/` (Fase 2 — Brand Kit + Nicho)

`brand.module.ts` original mantido fiel. As peças que ele importava
(`NichePreset`, `BrandKit`, `NichePresetsService`, `BrandKitsService`,
`BrandController`) **não existiam em nenhum dos 5 pacotes recebidos** —
reconstruídas do zero, alinhadas ao que já existe na matriz:
- `BrandKit` usa os MESMOS nomes de campo (`palette`, `font_family`,
  `logo_url`) do `BrandKitDto` que `GraphicComposerService` já consome, pra
  permitir salvar um kit nomeado e reutilizá-lo sem reenviar tudo a cada
  chamada (`toComposerDto()`).
- `NichePreset` é semeado (migration) com as mesmas 4 chaves já hardcoded em
  `engines/m8/niche-preset.service.ts` (`marcenaria`, `farmacia`, `mercado`,
  `escritorio`) — os dois catálogos ficam em sincronia.

## Banco de dados

Nova migration `1753900600000-AddAuthUsageAndBrandTables.ts`: tabelas
`users`, `niche_presets` (com seed), `brand_kits` + colunas de cota em
`tenants`. Roda automaticamente (`migrationsRun: true`, já configurado).

## Dependências novas (`package.json`)

`@nestjs/jwt`, `bcryptjs` (+ `@types/bcryptjs`), `ioredis`.

## Verificação

`npx tsc --noEmit` rodado e comparado ANTES/DEPOIS: zero erros novos. Os
únicos erros de typecheck (`app.ts`, `index.ts`, `lib/logger.ts`,
`routes/health.ts`, `graphic-composer.service.ts`,
`ai-orchestrator.service.ts`, `webhooks.controller.ts`) já existiam
identicamente na matriz original, antes de qualquer mudança desta entrega —
não fazem parte do `AppModule` atual (são arquivos legados/soltos) ou são
bugs pré-existentes fora do escopo pedido.

## Pendente (próxima etapa, aguardando sua confirmação)

Front-end: `estudio-de-video-ia.zip` e `sistema-de-avatares.zip` têm
`apps/web` quase idênticos entre si e ao `apps/web` da matriz, exceto:
`lib/measurement/gates.ts` (só existe no pacote de avatares) e diferenças de
tamanho em `audit-panel.tsx`, `studio-shell.tsx`, `video-generator.tsx`.
Ainda não mesclado nesta entrega — foco foi fechar o backend
(cadastro/login/cotas/brand) primeiro.

---

# Rodada 2 — lucrom-studio-COMPLETO-FINAL.zip

Pacote parcial (17 arquivos-patch, conforme MANIFEST.md dele) de OUTRA
conversa/sessão, mais avançada em funcionalidade de produto. Mesclado nesta
rodada:

## Billing (Mercado Pago) — módulo novo, adotado integralmente
`billing/payment.entity.ts`, `billing.service.ts`, `billing.controller.ts`,
`billing.module.ts` + migration `1753900700000-AddPayments.ts` (renumerada
de `1753902000000` pra encaixar depois da minha `1753900600000`). Só ajustei
o path do import do guard (`../auth/guards/jwt-auth.guard` → `../auth/jwt-auth.guard`,
pasta que não uso aqui).

## Usage — correção de segurança (IDOR) adotada
`UsageController.peek(:tenantId)` da Rodada 1 pegava o tenant da URL —
**qualquer usuário autenticado podia consultar a cota de OUTRO tenant** só
trocando o UUID. Corrigido: `tenantId` agora vem SEMPRE do JWT verificado
(`req.user.tenantId`), nunca de parâmetro de rota. Rotas viraram
`GET /api/v1/usage/peek` e `POST /api/v1/usage/consume` (sem `:tenantId` na
URL). Adicionado plano `PRO` (100 gerações/mês) e `UsageService.upgradePlan()`,
chamado pelo `BillingService` após confirmação de pagamento.

## Auth — refinamentos adotados, rate-limit mantido
`RegisterDto`: `tenant_name` (obrigatório) virou `businessName` (opcional,
cai pro prefixo do e-mail); senha ganhou regra mais forte (8+ caracteres,
letra+número). **Mantive** meu rate-limit de login via Redis (a versão nova
usava `Map` em memória — quebra com múltiplas réplicas/instâncias, cenário
real de produção). Renomeei `UserJwtPayload` → `JwtPayload` (nome que todo o
resto do pacote novo já esperava).

`JwtAuthGuard`: agora aceita o token em DOIS formatos —
`X-User-Token: <jwt>` (usado pelo frontend Next.js) OU
`Authorization: Bearer <jwt>` (padrão) — sem isso, nada no `apps/web` teria
autorizado.

## Frontend (`apps/web`) — capacidades inteiramente novas, adotadas
Geração de anúncio com IA real (Gemini/DeepSeek/FLUX/Edge-TTS com fallback
gratuito em cascata), publicação direta no Instagram, checkout de upgrade
PRO via Mercado Pago (PIX/cartão), landing page (`/`) + Studio movido pra
`/studio`, badge de cota e modal de upgrade na UI.

**Duas peças que o pacote referenciava mas não incluía** (`lib/api/client.ts`
já existia igual na matriz; `lib/auth/session-store.ts` não existia em
nenhum lugar) — reconstruí `session-store.ts` do zero, mecanicamente, a
partir dos 6 pontos de uso já espalhados pelos outros arquivos (contrato
`Session`/`getSession`/`setSession`/`clearSession`/`subscribeSession` já
estava implícito neles). Atualizei `client.ts` pra anexar `X-User-Token`
automaticamente em toda chamada, como os comentários do pacote novo já
diziam que aconteceria.

## Fora do escopo desta entrega (SEM fonte, SEM especificação)
O `app.module.ts` do pacote novo importa 11 módulos que não existem em
NENHUM dos 6 zips recebidos até agora: `PreFlightModule`,
`RealtimeGatewayModule`, `SocialIntegrationsModule`, `ContractsModule`,
`ObservabilityModule`, `EventBusModule`, `BusinessEngineModule`,
`StrategyEngineModule`, `CreativeEngineModule`, `LearningEngineModule`,
`DirectorEngineModule` (+ `CorrelationIdMiddleware`, + migrations até
`1753901600000`). **Não foram criados** — construir isso do zero sem
especificação seria inventar regra de negócio, não reescrever código seu.
Ficam de fora do `AppModule` até você definir o que cada um faz.

## Verificação
`npx tsc --noEmit` limpo nos dois apps (`apps/api` e `apps/web`) — comparado
arquivo por arquivo contra a versão anterior: zero erros novos introduzidos.
Os erros que aparecem (`app.ts`, `index.ts`, `lib/logger.ts`,
`routes/health.ts`, `graphic-composer.service.ts`,
`ai-orchestrator.service.ts`, `webhooks.controller.ts`, `consent-store.ts`)
já existiam identicamente ANTES desta entrega, confirmado rodando `tsc`
contra a matriz original sem nenhuma alteração minha.


---

## Ajuste adicional — Somente APIs chinesas na geração de vídeo (08/2026)

**Pedido do cliente:** usar somente API chinesa na orquestração de vídeo,
sem intermediários americanos.

**O que mudou (escopo: só `engines/m8/ai-orchestrator/` e o webhook que ele
usa — o resto do código, incluindo Flux/WhisperX/RVM via Replicate, script
generator via Claude, publicação no Instagram, billing via Mercado Pago e
todo o frontend, permanece 100% intacto):**

| Antes | Depois |
|---|---|
| Fal.ai (EUA) como provedor primário, revendendo acesso ao modelo Kling (Kuaishou/China) | **API oficial direta da Kling** (kling.ai/dev) — mesmo modelo, sem intermediário |
| Replicate (EUA) como fallback, revendendo acesso ao modelo MiniMax/Hailuo (China) | **API oficial direta da MiniMax** (platform.minimax.io) — mesmo modelo, sem intermediário |

**Arquivos novos:**
- `apps/api/src/engines/m8/ai-orchestrator/kling-client.service.ts`
- `apps/api/src/engines/m8/ai-orchestrator/minimax-client.service.ts`

**Arquivos modificados (lógica de negócio do circuit breaker preservada
integralmente — só a camada de transporte HTTP mudou):**
- `ai-orchestrator.service.ts`
- `ai-generation-job.entity.ts` (tipo `AiProvider`: `'fal'|'replicate'` → `'kling'|'minimax'`)
- `ai-orchestrator.module.ts`
- `webhooks.controller.ts` (normalização de payload adaptada aos formatos nativos da Kling e da MiniMax, incluindo o desafio de validação de callback da MiniMax)
- `config/configuration.ts`
- `.env.example`

**Importante:** `REPLICATE_API_TOKEN` continua necessário — ele NÃO foi
removido do projeto, porque outros três serviços dependem dele para
funcionalidades diferentes (RVM, WhisperX/DeepFilterNet, Flux). Só a rota de
GERAÇÃO DE VÍDEO deixou de passar pelo Replicate/Fal.ai.

**Validação:** `npm run typecheck` roda com exatamente o mesmo conjunto de
erros pré-existentes do projeto original (não relacionados a este ajuste,
já presentes antes da mudança) — nenhum erro novo foi introduzido pelas
alterações acima.
