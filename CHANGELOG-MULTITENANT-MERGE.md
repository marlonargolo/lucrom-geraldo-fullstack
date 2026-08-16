# Fusão do patch de isolamento multi-tenant (`lucrom-studio-multitenant-fix`)

Este patch chegou como um pacote separado (35 arquivos), mais recente que a
base consolidada mas **desenvolvido em paralelo**, a partir de uma versão
ligeiramente mais antiga dela. Aplicá-lo por cima, arquivo a arquivo sem
checagem, teria **revertido duas melhorias já existentes** na base
consolidada. Esta fusão foi feita com checagem cruzada, não substituição
cega — ver detalhamento abaixo.

## O que o patch corrigia (motivação original, preservada integralmente)

Duas falhas reais de isolamento entre tenants (MEIs) diferentes:

1. **IDOR em ~11 serviços**: `findOneOrFail(id)` buscava um recurso só pelo
   UUID, sem checar de qual tenant ele era. Qualquer chamador que soubesse
   (ou adivinhasse) o UUID de um recurso de outro tenant — roteiro, vídeo
   editado, job de geração, brand kit, sessão do Director — conseguia
   lê-lo. Corrigido em: `media-assets`, `brand-kits`, `video-edit`,
   `format-export`, `m8` (render jobs), `ai-orchestrator`, `avatar-orchestrator`,
   `graphic-composer`, `voice-commands`, `script-generator`, `director`
   (sessões, contratos de produção).
2. **Token de serviço vazando pro navegador**: `lib/api/client.ts` mandava
   `Authorization: Bearer <API_TOKEN>` (segredo servidor-a-servidor) direto
   do browser pro NestJS, usando `NEXT_PUBLIC_API_TOKEN` — visível a
   qualquer visitante via devtools. Endpoints como `POST /api/v1/consent` e
   `POST /api/v1/engines/m8/ai-video/generate` ficavam acessíveis sem
   login. Corrigido com um proxy same-origin novo,
   `app/api/backend/[...path]/route.ts`, que exige um usuário autenticado
   de verdade e nunca expõe o token no bundle do cliente.

## Aplicação direta (25 arquivos) — sem conflito

Controllers, services e DTOs onde o patch só acrescentava `tenantId` ao
`findOneOrFail`/`@Query`, sem tocar em nenhuma lógica adicionada depois na
base consolidada. Aplicados como vieram: `media-assets`, `brand`
(controller e service), `engines/m8/edit`, `engines/m8/format-export`,
`engines/m8/m8.{controller,service}`, `engines/m8/ai-orchestrator.controller`,
`engines/avatar`, `creative/voice-commands`, `creative/graphic-composer`,
`creative/script-generator`, DTOs do Director (`advance-business`,
`advance-strategy`, `advance-creative`, `create-session`), rotas de billing
do frontend (`checkout`, `webhook`), `lib/api/client.ts`, `lib/production/backend-proxy.ts`,
e o arquivo novo `app/api/backend/[...path]/route.ts`.

## Conflitos resolvidos manualmente (não foi substituição cega)

### `ai-orchestrator.service.ts`
O patch tinha divergido de **antes** da consolidação ter trocado o estado
do circuit breaker (Kling → MiniMax) de memória local pra Redis
(pré-requisito pra rodar com múltiplas réplicas atrás de um load
balancer — ver `CHANGELOG-CONSOLIDACAO.md`). Aplicar o patch inteiro teria
**revertido essa melhoria silenciosamente**. Mantido: o circuit breaker via
Redis da base consolidada. Aplicado: só a correção de isolamento em
`findOneOrFail(id, tenantId)`.

### `director.service.ts` / `director.controller.ts`
O patch removia `findProductionContractBySession` e o endpoint
`GET :id/production-contract`, substituindo por um `getRenderStatus` novo
(`GET :id/render-status`) que já traduz o status do job de IA pra UI. A
base consolidada, numa passada posterior, tinha acabado de **adicionar**
o acompanhamento de progresso no frontend em cima do endpoint antigo
(`use-ai-video-status.ts`, `production-contract/route.ts`,
`ai-video/[id]/route.ts`). Resultado: **mantidos os dois endpoints**,
ambos isolados por tenant — `production-contract` (usado hoje pelo
frontend) e `render-status` (endpoint mais completo do patch, disponível
pra uso futuro sem quebrar o que já está integrado).

### `advance-production.dto.ts`
O patch removia o campo `aspectRatio` (op\u00e7\u00e3o de formato do v\u00eddeo,
enviada pelo cliente) junto com a correção de isolamento — mudança de
comportamento de produto sem relação com o fix de segurança. Mantido:
`aspectRatio` opcional, como já era. Aplicado: `tenantId` obrigatório.

### `.env.local.example`
Mesclados os três: renomeação do token (`NEXT_PUBLIC_API_TOKEN` →
`API_TOKEN`, sem prefixo — o próprio fix), o bloco de comentário sobre
`REDIS_HOST`/`REDIS_PORT` (rate limiting distribuído, adicionado depois na
base consolidada) e a flag nova `NEXT_PUBLIC_SHOW_INTERNAL_VIEWS`.

## Lacunas encontradas e fechadas nesta fusão (não vinham prontas em nenhum dos dois pacotes)

Aplicar só os arquivos do patch teria **quebrado em runtime** partes que
funcionavam antes — a auditoria cruzada identificou e fechou:

1. **7 rotas proxy do frontend** (`app/api/production/sessions/**`,
   `app/api/production/ai-video/[id]/route.ts`) não mandavam `tenantId`
   pro backend, que passou a exigi-lo (query string nos `GET`, corpo nos
   `POST`). Sem isso, todo o fluxo do Director Engine (criar sessão, avançar
   estágio, consultar progresso) responderia 400 depois do merge. Corrigido
   injetando `auth.user.tenantId` (já disponível via `requireUser`, o JWT
   validado) em cada chamada.
2. **`NEXT_PUBLIC_SHOW_INTERNAL_VIEWS` documentada mas não conectada a
   nada** — o patch adicionava a variável no `.env.local.example` sem
   nenhum código que a lesse. Conectada em `studio-shell.tsx`: a aba
   "Arquitetura" (diagrama interno do sistema) só aparece com a flag em
   `true`.
3. **`docker-compose.yml` e `apps/web/Dockerfile` ainda expunham o token**
   — mesmo depois do código parar de usar `NEXT_PUBLIC_API_TOKEN`, o
   `docker-compose.yml` continuava passando o segredo como build arg
   `NEXT_PUBLIC_API_TOKEN` pro Dockerfile do frontend, que o gravava como
   `ENV` de build (ou seja: embutido no bundle do navegador de qualquer
   forma, reintroduzindo a mesma vulnerabilidade por outra porta, mesmo com
   o código-fonte já corrigido). Corrigido: `API_TOKEN` agora vai só como
   variável de ambiente de **runtime** do container `web` — nunca como
   build arg.

## Verificação

`npx tsc --noEmit` rodado, do zero (com `npm ci` limpo), em `apps/api` e em
`apps/web` após a fusão completa: **zero erros nos dois** — nenhum arquivo
ficou chamando uma assinatura antiga (`findOneOrFail` com 1 argumento onde
agora são exigidos 2, DTOs sem o campo `tenantId`, etc.).

## Residual — fora do escopo desta fusão, sinalizado para decisão

- `GET /brand/brand-kits?tenant_id=...` (listagem) e padrões
  `GET .../tenant/:tenantId` continuam confiando no valor de `tenant_id`
  vindo da URL/query sem cross-check contra o JWT quando chamados fora do
  proxy `app/api/backend/[...path]/route.ts` (que já reescreve o segmento
  `tenant/:id` da URL pelo tenant real — mas só cobre esse padrão
  específico de path, não query string `?tenant_id=`). Nenhum componente
  do frontend hoje chama esse endpoint com um `tenant_id` arbitrário
  (sempre usa o da própria sessão), então não há caminho de exploração
  ativo no produto atual — mas o backend, isoladamente, ainda aceitaria.
  Mesma categoria de risco do que já foi corrigido; recomendo tratar numa
  próxima rodada, aplicando o mesmo padrão (`tenantId` obrigatório, vindo
  do JWT) às rotas `findByTenant`.
