# Consolidação — Director Engine + injeção do painel "Pipeline real"

Base: `lucrom_ajustado` (código 1). Recurso injetado: `pipeline-real` (código 2, 13 arquivos).

## 1. Código morto removido (confirmado, zero importadores)
- `apps/api/src/app.ts`, `index.ts`, `routes/index.ts`, `routes/health.ts`,
  `lib/logger.ts` — esqueleto Express paralelo ao NestJS real (`main.ts`),
  órfão desde a migração. `routes/health.ts` importava `@workspace/api-zod`,
  que nem está nas dependencies — não compilaria se alguém tentasse usar.
- Pasta vazia `src/middlewares/` removida.
- Total: 98 linhas. Confirma que o código 1 é enxuto — não havia "gordura"
  significativa pra cortar.

## 2. Arquivos injetados do código 2 (sem alteração)
`app/api/production/sessions/route.ts` (+ `[id]/route.ts`, `.../business`,
`.../strategy`, `.../creative`, `.../production`), `real-pipeline-panel.tsx`,
`backend-proxy.ts`, `real-production-client.ts`, `use-real-production.ts`.
`brand.module.ts` do código 2 era idêntico ao do código 1 — ignorado.

## 3. `studio-shell.tsx` — patch aditivo aplicado
Nova aba "Pipeline real" (`view === "real"` → `<RealPipelinePanel />`) +
`<LoginGate />` no header. Sem conflito com o resto da tela.

## 4. `brand-client.ts` — reescrito (incompatibilidade real corrigida)
Original do código 2 não batia com `brand.controller.ts`/`CreateBrandKitDto`
do código 1 (faltava `tenant_id` obrigatório, `slug`/`typography`/`voice`
não existem na entidade). Reescrito pra usar `tenant_id` da sessão JWT ativa
e os campos reais de `BrandKit`.

## 5. Director Engine construído (`apps/api/src/engines/director/`)
Módulo inteiro ausente de todos os pacotes recebidos até agora (confirmado
no próprio `CHANGELOG-UNIFICACAO.md` do código 1). Implementado:

- **Entidades**: `ProjectSession` (máquina de estágio), `BusinessTicket`,
  `StrategyBrief`, `CreativeManifest`, `ProductionContract`.
- **Migration**: `1753900900000-AddDirectorEngine.ts`.
- **Business Engine**: score de viabilidade determinístico (0-100, limiar 50)
  baseado em completude da descrição do problema e da meta — auto-`ABORTED`
  abaixo do limiar, como a UI já anunciava.
- **Strategy Engine**: persiste o brief estruturado (Algoritmo de Conflito
  Triplo), sem rejeição automática — os enums já vêm fechados do frontend.
- **Creative Engine**: NÃO reimplementa geração de roteiro — traduz o
  `StrategyBrief` num briefing e chama `ScriptGeneratorService.generate()`
  (já existente, já com `LlmClientService`/Anthropic plugado).
- **Ponte Production**: cria o `ProductionContract` (empacota script + brand
  + tenant). Deliberadamente NÃO dispara o M8 de verdade — o próprio
  `real-pipeline-panel.tsx` já avisa isso ao usuário como pendente.
- **Guard**: `ApiTokenGuard` (mesmo padrão de `ai-orchestrator`/
  `script-generator`) — é exatamente o que `backend-proxy.ts` do frontend
  espera.
- Estágios `QUALITY`/`DONE` ficam no enum mas sem rota de avanço — mesma
  decisão do frontend (sem Quality/Learning Engine especificado ainda).

## 6. Limitação conhecida, documentada no código
`StrategyBrief.primary_channel = LINKEDIN_VIDEO` não tem plataforma
equivalente em `ScriptGeneratorService` (só reels/tiktok/youtube_shorts) —
cai pro formato reels mais próximo. `niche` também é fixado em `'escritorio'`
por não vir do fluxo Director — ajustar se o negócio tiver por nicho.

## Tamanho final
~21.500 linhas de código-fonte (`.ts`/`.tsx`) — dentro da faixa estimada
(21.500-22.500), não os 25-30 mil temidos inicialmente.

## Compilação — verificada de verdade (correção do que eu disse antes)
Rodei `npm install` + `npx tsc --noEmit` de verdade nos dois apps (não
precisa de nenhum workspace externo — o `package.json` só usa pacotes
públicos do npm). Resultado: **backend e frontend compilam limpo, 0 erros.**

No caminho, achei e corrigi 3 erros de tipo que já existiam no código 1
original (confirmados comparando com o zip intacto, nenhum deles introduzido
por esta consolidação):
- `graphic-composer.service.ts` (2 ocorrências) e `ai-orchestrator.service.ts`
  (1 ocorrência): `BrandKitDto` (classe validada, sem index signature) não é
  estruturalmente atribuível a `Record<string, unknown>` no `DeepPartial` do
  TypeORM — corrigido com cast explícito (`as unknown as Record<string,
  unknown>`), sem mudar a coluna `jsonb` das entidades (já corretas).
- `consent-store.ts`: `IDBRequest<ConsentRecord>` vs
  `IDBRequest<ConsentRecord | undefined>` — cast ajustado.

## Não verificado nesta entrega
Runtime contra Postgres real + `migration:run` da migration nova — não tenho
banco conectado aqui pra simular isso. `tsc` garante que os tipos batem, não
que a query SQL da migration roda sem erro num Postgres de verdade.
