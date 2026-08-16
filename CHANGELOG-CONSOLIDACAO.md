# Consolidação de código — Lucrom Studio

Passada de limpeza sobre os mesmos ~22.500 linhas de código (nenhuma
funcionalidade alterada), com o objetivo de remover marcas de como o código
foi construído em várias entregas e deixá-lo com cara de ter sido escrito
de uma vez, como uma peça só.

## O que foi feito

Varredura completa do repositório (múltiplos padrões: `AJUSTE`, `CORREÇÃO`,
`pós-auditoria`, `antes fazia/chamava`, `versão anterior`, `FASE 1/2 da
auditoria`, referências a pacotes/entregas anteriores) e reescrita de
**24 arquivos**, todos em `apps/api` e `apps/web`:

- Comentários que contavam a história de uma mudança ("antes chamava Fal.ai,
  agora chama Kling direto", "correção pós-auditoria: tenantId vem do JWT")
  viraram documentação no presente, só descrevendo o comportamento atual e
  o porquê.
- Referências a artefatos que não existem mais no projeto (nomes de pacotes
  recebidos, caminhos de arquivos de entregas antigas, itens de status
  report) foram removidas.
- Uma **docstring duplicada literalmente** foi encontrada e consolidada em
  `engines/m8/ffmpeg.service.ts` (bug de colagem, não afetava o
  comportamento — só poluía o arquivo).

Nenhuma lógica de negócio, assinatura de função, nome de classe ou
comportamento em runtime foi alterado — só comentários e documentação
inline.

## Verificação

`npx tsc --noEmit` rodado no backend completo após todas as edições:
**zero erros de compilação.**

## Estado distribuído via Redis (pré-requisito pra múltiplas réplicas)

Passada adicional, motivada pela pergunta "está pronto pra escalar": dois
pontos guardavam estado em memória do processo (`Map`/campos de classe), o
que funciona com 1 instância mas quebra silenciosamente com múltiplas
réplicas atrás de um load balancer — cada réplica teria seu próprio
contador, sem visibilidade das outras.

Trocado por estado no Redis, compartilhado entre réplicas:

- **`AiOrchestratorService`** (backend) — circuit breaker Kling/MiniMax.
  Duas chaves Redis com TTL (`ai-orchestrator:kling:failures`,
  `ai-orchestrator:kling:open`) substituem os campos `consecutiveKlingFailures`/
  `circuitOpenedAt`.
- **`/api/ai/generate-ad`, `/api/media/upload`, `/api/instagram/publish`**
  (frontend) — rate limiting por usuário. Consolidado num helper único,
  `apps/web/lib/rate-limit.ts` (`createRateLimiter`), usado pelas 3 rotas.

Todos com fallback automático pra memória local se `REDIS_HOST` não estiver
configurado — não quebra desenvolvimento local sem Redis rodando, e uma
falha transitória do Redis em produção não trava usuários legítimos
(fail-open).

Adicionado `ioredis` às dependências do `apps/web` (mesma versão já usada
pelo `apps/api`) e documentado `REDIS_HOST`/`REDIS_PORT` em
`apps/web/.env.local.example`.

`npx tsc --noEmit` rodado nos dois apps (`apps/api` e `apps/web`) após essa
passada: **zero erros nos dois**.

## O que ainda falta pra escalar de verdade

Esta passada resolve o estado em memória, mas não é suficiente sozinha.
Ainda falta, antes de qualquer escala real:

1. **Testar contra infraestrutura real** — Postgres, Redis, Kling, MiniMax
   de verdade. Nada disso rodou ainda fora de análise estática de código
   (`tsc --noEmit`); as migrations nunca rodaram contra um Postgres real, e
   o schema de request/response do Kling/MiniMax foi implementado só a
   partir da documentação pública, sem validar contra conta de
   desenvolvedor real.
2. ~~`advanceProduction` não dispara o M8 de verdade~~ — **resolvido, ver
   seção abaixo.**
3. Frontend do avatar engine (sem UI ainda pra `/api/v1/engines/avatar/*`).
4. Storage cai pro filesystem local sem `S3_ACCESS_KEY` configurado — ok
   pra dev, inviável em produção com múltiplas instâncias (cada réplica
   veria um disco `/tmp` diferente).

## `advanceProduction` conectado ao pipeline real de vídeo

Fechava a lacuna documentada: o Director Engine, ao chegar no estágio
PRODUCTION, agora dispara de verdade a geração de vídeo — não fica mais só
no contrato empacotado.

- **`DirectorService.advanceProduction`** — depois de montar o
  `ProductionContract`, chama `AiOrchestratorService.submit()` (o mesmo
  serviço usado por `POST /api/v1/engines/m8/ai-video/generate`) com:
  - `prompt`: hook + roteiro por segmentos + cta do `ScriptContract`
    gerado no estágio CREATIVE, concatenados em texto corrido
    (`buildPromptFromScript`);
  - `aspect_ratio`: '9:16' por padrão (Reels/TikTok/Shorts — os canais do
    Strategy Engine), configurável via `AdvanceProductionDto.aspectRatio`;
  - `brand_kit`: paleta do Brand Kit da sessão.
- **`ProductionContract`** ganhou a coluna `ai_generation_job_id` (aponta
  pra `ai_generation_jobs`, consultável em
  `GET /api/v1/engines/m8/ai-video/:id`) e o `status` passou a ter 3
  valores: `READY` (transitório) → `GENERATING` (job criado) ou
  `DISPATCH_FAILED` (falha antes mesmo de criar o job — ex.: tenant
  inválido; diferente de falha do provedor, que fica registrada no próprio
  job, não trava o contrato).
- **Migration nova**: `1754100000000-AddAiGenerationJobToProductionContract.ts`.
- Se o roteiro do Creative Manifest não estiver com `status: 'DONE'`,
  `advanceProduction` agora rejeita com 409 em vez de tentar gerar vídeo a
  partir de um roteiro vazio/falho.
- **Frontend**: `real-pipeline-panel.tsx` atualizado — a mensagem no
  estágio PRODUCTION não fala mais em "ponte não conectada"; reflete que a
  geração foi disparada de verdade.

`npx tsc --noEmit` rodado nos dois apps após essa mudança: **zero erros nos
dois.**

## Frontend: acompanhamento do job de geração

Fechava a lacuna "usuário dispara a produção mas não vê o progresso":

- **Backend**: novo endpoint `GET /api/v1/engines/director/sessions/:id/production-contract`
  (`DirectorService.findProductionContractBySession`) — expõe o
  `ai_generation_job_id` do contrato mais recente da sessão, que antes só
  existia no banco, sem rota de leitura.
- **Frontend**: dois proxies novos —
  `app/api/production/sessions/[id]/production-contract/route.ts` e
  `app/api/production/ai-video/[id]/route.ts` (este último já resolve a
  `download_url` assinada do vídeo final via `/api/v1/media-assets/:id`
  quando o job chega em DONE, pra frontend não precisar de uma segunda
  chamada).
- **`lib/production/use-ai-video-status.ts`** — hook novo: busca o contrato
  de produção pra achar o `ai_generation_job_id`, depois faz polling a cada
  5s em `GET /api/production/ai-video/:id` até DONE/FAILED.
- **`real-pipeline-panel.tsx`** — estágio PRODUCTION agora mostra estado
  real (na fila → gerando com Kling/MiniMax → pronto, com player de vídeo
  inline → ou erro do provedor/falha de disparo), em vez de uma mensagem
  estática.

`npx tsc --noEmit` rodado nos dois apps depois dessa mudança: **zero erros
nos dois.**

## O que ainda falta (atualizado)

1. **Testar contra infraestrutura real** — Postgres, Redis, Kling, MiniMax
   de verdade. Nada disso rodou ainda fora de análise estática de código
   (`tsc --noEmit`); as migrations nunca rodaram contra um Postgres real, e
   o schema de request/response do Kling/MiniMax foi implementado só a
   partir da documentação pública, sem validar contra conta de
   desenvolvedor real. **Este é o item que mais importa agora** — é o único
   jeito de confirmar que o fluxo ponta a ponta (Business → Strategy →
   Creative → Production → vídeo pronto, incluindo a UI de acompanhamento
   nova) funciona de verdade.
2. ~~Frontend não tem UI de acompanhamento do job~~ — **resolvido, ver
   seção acima.**
3. Frontend do avatar engine (sem UI ainda pra `/api/v1/engines/avatar/*`).
4. Storage cai pro filesystem local sem `S3_ACCESS_KEY` configurado — ok
   pra dev, inviável em produção com múltiplas instâncias (cada réplica
   veria um disco `/tmp` diferente).


## O que não foi feito nesta passada

- Reorganização de pastas (não foi necessária — a estrutura atual já reflete
  bem o formato final: `engines/director`, `engines/m8`, `engines/avatar`).
- Padronização de estilo/import order arquivo por arquivo — o código já
  seguia um padrão consistente (imports do NestJS → entidades → serviços
  locais), então não havia necessidade de mexer.
- `apps/web/lib/architecture-data.ts` e `studio-data.ts` (dados de UI/
  storytelling do produto, mencionam "Auditoria" como *feature* do produto
  — os 3 Portões de Auditoria do M10 — não como histórico de código; foram
  mantidos como estão, corretamente).
