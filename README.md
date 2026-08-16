# LUCROM Studio AI — Monorepo Unificado

Unificação do backend NestJS (`apps/api`) com o frontend Next.js
(`apps/web`), aplicando as correções da auditoria técnica. **Nenhuma lógica
de negócio pré-existente foi removida ou reescrita** — todas as mudanças
abaixo são adições cirúrgicas.

```
lucrom-studio/
├── docker-compose.yml        # Postgres 15, Redis 7, API, Worker, Web
├── apps/
│   ├── api/                  # Backend NestJS (original + correções)
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── audit-trail/          # NOVO — GET /api/v1/audit (AuthAuditMiddleware)
│   │       ├── webhooks/             # NOVO — POST /api/v1/webhooks/ai-video
│   │       ├── common/middleware/    # NOVO — auth-audit.middleware.ts
│   │       └── engines/m8/
│   │           ├── ai-orchestrator/  # NOVO — Fal.ai + circuit breaker + Replicate fallback
│   │           └── workers/          # NOVO — video-render.worker.ts (BullMQ isolado)
│   └── web/                  # Frontend Next.js (original + integração real)
│       ├── Dockerfile
│       └── lib/api/client.ts # NOVO — única camada de rede do frontend
```

## O que foi corrigido (auditoria)

### Backend
| Item | Onde | Descrição |
|---|---|---|
| Auditoria de Logs & Compliance | `common/middleware/auth-audit.middleware.ts` + `audit-trail/` | Middleware global grava toda ação POST/PUT/PATCH/DELETE em `audit_logs`. Aceita um JWT opcional em `X-Actor-Token` para identificar o ator (o `ApiTokenGuard` estático continua como autorização). |
| Geração de Vídeo Assíncrona | `engines/m8/ai-orchestrator/` | `POST /api/v1/engines/m8/ai-video/generate` retorna `202 Accepted` na hora; resultado chega via `POST /api/v1/webhooks/ai-video`. |
| Circuit Breaker (Fal.ai → Replicate) | `ai-orchestrator.service.ts` | Fal.ai é primário; após 3 falhas consecutivas o circuito abre e usa Replicate por 60s (configurável). |
| FFmpeg assíncrono isolado | `engines/m8/workers/video-render.worker.ts` | Worker BullMQ dedicado (`QUEUE_VIDEO_RENDER`): baixa o vídeo bruto, corta pro aspect ratio (`FfmpegService.cropToAspectRatio`, novo método), sobe pro S3/MinIO. |
| Containerização | `docker-compose.yml` | Postgres 15 + Redis 7 + API + Worker (mesma imagem, comando diferente) + Web. |

### Frontend
| Item | Onde | Descrição |
|---|---|---|
| Consentimento real | `lib/consent/consent-store.ts` | `addConsent`/`revokeConsent` agora também chamam `POST /api/v1/consent` (best-effort) — persiste como `status: LEGAL_CONSENT_GRANTED` no Postgres, além do IndexedDB local. `consent-manager.tsx` não precisou mudar: já chamava `addConsent`. |
| Painel de auditoria dinâmico | `components/studio/audit-panel.tsx` | Busca `GET /api/v1/audit` de verdade; usa a simulação local só como fallback se a API não estiver configurada/disponível. |
| Aspect ratio no payload | `components/studio/briefing-composer.tsx` | Ao clicar "Produzir peça", também dispara `POST /api/v1/engines/m8/ai-video/generate` com `aspect_ratio` (`9:16`/`16:9`/`1:1`) derivado do formato escolhido. |

⚠️ **Nota de arquitetura:** o frontend, antes da unificação, era 100% local
(IndexedDB + simulação client-side determinística em `lib/use-production.ts`)
— não existia nenhuma chamada de rede ao backend. As integrações acima são
"best-effort": se a API não estiver configurada (`NEXT_PUBLIC_API_BASE_URL`),
a experiência local continua funcionando exatamente como antes.

## Como rodar

```bash
cp apps/api/.env.example apps/api/.env      # preencher API_TOKEN, FAL_API_KEY, etc.
cp apps/web/.env.local.example apps/web/.env.local
docker compose up --build
```

- API: http://localhost:3000
- Web: http://localhost:3001

A migration roda automaticamente no boot do container `api`
(`npm run migration:run && node dist/main.js`).

## Rodando sem Docker (dev local)

```bash
# Backend
cd apps/api && npm install && npm run build && npm run migration:run
npm start            # processo API
npm run start:worker  # processo Worker (outro terminal)

# Frontend
cd apps/web && npm install && npm run dev
```
