"use client"

import { useCallback, useEffect, useState } from "react"
import { getSession, subscribeSession } from "@/lib/auth/session-store"
import { fetchQuota, type QuotaPeek } from "./quota-client"

export interface UseQuotaResult {
  quota: QuotaPeek | null
  loading: boolean
  loggedIn: boolean
  /** Chame depois de uma geração bem-sucedida pra refletir o consumo sem esperar o próximo mount. */
  refresh: () => void
}

/**
 * Mantém a cota do tenant atualizada automaticamente quando a sessão muda
 * (login, logout, sessão expirada limpa por generate-ad-client.ts). Cada
 * componente que usa este hook faz sua própria consulta — é uma chamada
 * leve (peek, sem side-effect no backend), então a duplicação entre
 * video-generator.tsx e briefing-composer.tsx é aceitável e mais simples
 * que introduzir um Context só pra isso.
 */
export function useQuota(): UseQuotaResult {
  const [quota, setQuota] = useState<QuotaPeek | null>(null)
  const [loading, setLoading] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  const refresh = useCallback(() => {
    const session = getSession()
    setLoggedIn(Boolean(session))
    if (!session) {
      setQuota(null)
      return
    }
    setLoading(true)
    fetchQuota()
      .then(setQuota)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
    return subscribeSession(refresh)
  }, [refresh])

  return { quota, loading, loggedIn, refresh }
}
