// Sessão do usuário autenticado (JWT emitido por POST /api/v1/auth/login,
// ver apps/api/src/auth/auth.service.ts). Guardada em localStorage — este é
// um frontend Next.js client-heavy (sem cookies HTTP-only de sessão), então
// o token vive no navegador e é anexado manualmente em cada chamada
// protegida via header X-User-Token (ver lib/api/client.ts e
// lib/auth/require-user.ts nas Route Handlers).
//
// Reconstruído a partir dos pontos de uso já existentes em
// components/studio/login-gate.tsx, lib/ai/generate-ad-client.ts,
// lib/usage/use-quota.ts, lib/usage/quota-client.ts,
// lib/billing/checkout-client.ts e lib/instagram/publish-client.ts — o
// contrato (`Session`, `getSession`/`setSession`/`clearSession`/
// `subscribeSession`) já estava implícito neles antes deste arquivo existir.

const STORAGE_KEY = 'lucrom:session'

export interface Session {
  accessToken: string
  userId: string
  email: string
  tenantId: string
}

type Listener = () => void
const listeners = new Set<Listener>()

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function notify(): void {
  for (const listener of listeners) listener()
}

/** `null` no servidor (SSR) e sempre que não há sessão válida guardada. */
export function getSession(): Session | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Session>
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.tenantId !== 'string'
    ) {
      return null
    }
    return parsed as Session
  } catch {
    return null
  }
}

export function setSession(session: Session): void {
  if (!isBrowser()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  notify()
}

export function clearSession(): void {
  if (!isBrowser()) return
  window.localStorage.removeItem(STORAGE_KEY)
  notify()
}

/**
 * Assina mudanças de sessão (login/logout/expiração) — usado por hooks como
 * `useQuota` pra reagir sem precisar de um Context provider global. Também
 * escuta o evento `storage` do navegador, pra sincronizar entre abas.
 */
export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener)
  if (isBrowser()) {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) listener()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', onStorage)
    }
  }
  return () => listeners.delete(listener)
}
