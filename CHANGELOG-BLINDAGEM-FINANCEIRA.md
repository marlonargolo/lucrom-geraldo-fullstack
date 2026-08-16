# Blindagem Financeira — Auditoria e Correções

Auditoria completa do fluxo de geração de IA paga (roteiro via DeepSeek +
vídeo via Kling/MiniMax) contra o checklist de 4 camadas de proteção
financeira (trava de cota no backend, prévia de baixo custo antes do
render pesado, estorno em falha técnica, limite de caracteres no
frontend). Resultado: 2 brechas críticas e 2 lacunas menores encontradas e
corrigidas.

## Achados

### 1. CRÍTICO — Geração de vídeo real sem nenhuma checagem de cota

Existiam **dois caminhos** até Kling/MiniMax (provedor pago por chamada) e
nenhum dos dois passava pela trava de cota (`UsageService.consume`,
implementada e correta desde o lançamento AVULSO/PACOTE5):

- `POST /api/production/sessions/:id/production` (Director Engine —
  fluxo principal do produto: Business → Strategy → Creative →
  **Production**) — usava só `requireUser` (autenticação), sem
  `requireUserWithQuota`.
- `POST /api/v1/engines/m8/ai-video/generate` (endpoint legado consumido
  por `briefing-composer.tsx`, via proxy `/api/backend/[...path]`) —
  mesmo problema.

Um tenant no plano CREATOR (limite 1 vídeo/mês) conseguia gerar vídeos
reais **ilimitados** por qualquer um dos dois caminhos, sem nunca esbarrar
no limite nem consumir crédito avulso.

`POST /api/production/sessions/:id/creative` (dispara o LLM/DeepSeek —
custo bem menor) tinha a mesma lacuna de autenticação (sem rate limit),
embora com impacto financeiro menor.

### 2. Estorno em falha técnica não existia

Quando o provedor (Kling/MiniMax) falhava depois de aceitar a submissão —
ou os dois provedores falhavam na hora de submeter —, o job ficava
`FAILED` mas nenhum crédito era devolvido ao tenant, mesmo já tendo sido
implementada (corretamente) a trava de cota nos outros pontos.

### 3. Caracteres livres sem limite visível no formulário

Os campos de texto livre do fluxo Business/Strategy Engine
(`real-pipeline-panel.tsx`) já eram validados no backend
(`@MaxLength(...)` nos DTOs — isso **já estava correto**), mas não tinham
`maxLength` no HTML, então o usuário só descobria o limite depois de um
round-trip completo até o servidor.

### 4. Prévia de baixo custo antes do render pesado

Na verdade **já implementado** pela própria arquitetura em estágios: o
estágio CREATIVE gera só o roteiro/copy (DeepSeek, custo baixo) e é um
estágio *separado* do PRODUCTION (Kling/MiniMax, custo alto) — o usuário
só aciona o render pesado depois de já ver o roteiro. Isso não precisou de
correção, só passou a estar documentado explicitamente (ver comentário em
`director.service.ts` e nos Route Handlers `.../creative` e
`.../production`).

## Correções aplicadas

**Backend (`apps/api`)**

- `AiOrchestratorService.submit()` — ponto único por onde toda geração de
  vídeo passa (Director Engine **e** endpoint legado) — agora chama
  `UsageService.consume()` e CONFIRMA `allowed: true` antes de qualquer
  requisição sair para Kling/MiniMax. Sem cota disponível, lança
  `QuotaExceededException` (402) e nenhuma chamada paga é feita.
- Nova migration `AddQuotaChargeTrackingToAiGenerationJobs`: colunas
  `quota_charged`, `quota_charged_extra_credit`, `quota_refunded` em
  `ai_generation_jobs`, para saber COMO e SE estornar.
- `UsageService.refund()` — estorno atômico (cota mensal, com proteção de
  virada de mês via `GREATEST(0, ...)` + checagem de período; ou crédito
  avulso, via `increment` direto).
- `AiOrchestratorService.markFailed()` — novo método central que marca o
  job como `FAILED` e estorna a cota debitada, de forma **idempotente**
  (`quota_refunded`) — cobre os 3 pontos onde um job pode falhar:
  submissão inicial, webhook de falha do provedor, erro ao resolver
  `file_id` da MiniMax.
- `DirectorService.advanceProduction` — distingue `QuotaExceededException`
  (propaga como 402, desfaz o contrato de produção criado, sessão
  permanece em CREATIVE pronta pra nova tentativa) de qualquer outra falha
  de infraestrutura (`DISPATCH_FAILED`, cota já debitada nesse caso).

**Frontend (`apps/web`)**

- `/api/production/sessions/[id]/production/route.ts` — rate limit
  (Redis, 5 req/min por usuário) como segunda camada de defesa.
- `/api/production/sessions/[id]/creative/route.ts` — rate limit (Redis,
  10 req/min por usuário).
- `real-pipeline-panel.tsx` — `maxLength` HTML nos campos de texto livre,
  espelhando os limites já existentes nos DTOs do backend (500–4000
  caracteres conforme o campo).

**Verificação**

- `npx tsc --noEmit` limpo em `apps/api` e `apps/web` após todas as
  alterações (zero erros de tipo).
