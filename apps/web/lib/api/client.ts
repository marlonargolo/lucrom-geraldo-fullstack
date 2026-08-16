/**
 * Cliente HTTP para a API NestJS (`apps/api`) — via `/api/backend/*`
 * (`app/api/backend/[...path]/route.ts`), NUNCA direto do navegador pro
 * NestJS. Este frontend era, até a unificação, 100% local (IndexedDB +
 * simulação client-side em `lib/use-production.ts`) — nenhuma chamada de
 * rede existia. Este módulo é a integração real, usada por:
 *   • lib/consent/consent-store.ts → POST /api/v1/consent
 *   • components/studio/audit-panel.tsx → GET /api/v1/audit
 *   • components/studio/briefing-composer.tsx → POST /api/v1/engines/m8/ai-video/generate
 *   • lib/usage/quota-client.ts → GET /api/v1/usage/peek (JwtAuthGuard)
 *   • lib/billing/checkout-client.ts → GET /api/v1/billing/checkout-intents/:id (JwtAuthGuard)
 *
 * Todas as chamadas são "best-effort": se a API não estiver configurada ou
 * estiver fora do ar, a experiência local (IndexedDB/simulação) continua
 * funcionando — ver comentários em cada call-site.
 *
 * Correção pós-auditoria (Isolamento de Tenants): este arquivo rodava no
 * navegador e mandava `Authorization: Bearer <API_TOKEN>` (o segredo
 * serviço-a-serviço do ApiTokenGuard) direto pro NestJS — como
 * `NEXT_PUBLIC_API_TOKEN` vai pro bundle do cliente, esse token estava
 * visível a qualquer visitante via devtools, dando acesso total (sem login
 * nenhum) a endpoints como POST /api/v1/consent e
 * POST /api/v1/engines/m8/ai-video/generate. Agora as chamadas vão pro
 * proxy same-origin `/api/backend/*`, que anexa o `API_TOKEN` só server-side
 * e exige um X-User-Token válido (JWT do usuário logado) — ver o cabeçalho
 * de app/api/backend/[...path]/route.ts para o resto da correção.
 */

import { getSession } from '../auth/session-store';

/** Prefixo do proxy same-origin — nunca aponta pro NestJS diretamente a partir do navegador. */
const PROXY_BASE_URL = '/api/backend';

/** Tenant padrão deste ambiente (fluxos legados que ainda assumem um tenant fixo) — ver .env.local.example. */
export const DEFAULT_TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * true quando há uma sessão de usuário ativa — sem login, `/api/backend/*`
 * responde 401 antes mesmo de tentar falar com o NestJS (ver `requireUser`),
 * então "configurado" agora depende de sessão, não só de env var.
 */
export function isApiConfigured(): boolean {
  return Boolean(getSession());
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getSession();
  if (!session) {
    throw new ApiError('Faça login para usar este recurso.', 401);
  }

  // path já vem como "/api/v1/..." nos call-sites — remove a barra dupla ao concatenar.
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

  const res = await fetch(`${PROXY_BASE_URL}/${normalizedPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Token': session.accessToken,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(`API ${path} respondeu ${res.status}: ${body}`, res.status);
  }

  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}
