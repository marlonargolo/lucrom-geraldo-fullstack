import { getSession } from '../auth/session-store'

const PROXY_BASE_URL = '/api/backend'
export const DEFAULT_TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? ''

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * true quando a URL do backend está configurada E há sessão ativa.
 * Usado pelo BriefingComposer para decidir se dispara o render real.
 */
export function isApiConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_BASE_URL && getSession())
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getSession()

  const isPublicAuthRoute =
    path.includes('/auth/login') || path.includes('/auth/register')

  if (!session && !isPublicAuthRoute) {
    throw new ApiError('Faça login para usar este recurso.', 401)
  }

  const normalizedPath = path.startsWith('/') ? path.slice(1) : path

  const res = await fetch(`${PROXY_BASE_URL}/${normalizedPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { 'X-User-Token': session.accessToken } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(`API ${path} respondeu ${res.status}: ${body}`, res.status)
  }

  if (res.status === 204) return undefined as unknown as T
  return (await res.json()) as T
}