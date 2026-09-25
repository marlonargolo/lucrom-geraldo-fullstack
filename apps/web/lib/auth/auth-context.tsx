"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { getSession, setSession, clearSession, subscribeSession, type Session } from "./session-store"
import { apiFetch, ApiError } from "@/lib/api/client"

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export interface LegalAcceptance {
  termsVersion: string
  privacyVersion: string
}

export function friendlyApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const match = err.message.match(/respondeu \d+: (.*)$/)
    if (match) {
      try {
        const parsed = JSON.parse(match[1])
        if (Array.isArray(parsed?.message)) return parsed.message.join(" ")
        if (typeof parsed?.message === "string") return parsed.message
      } catch { /* noop */ }
    }
    return err.message
  }
  return err instanceof Error ? err.message : "Falha inesperada."
}

interface AuthContextValue {
  session: Session | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, businessName: string | undefined, legalAcceptance: LegalAcceptance) => Promise<void>
  logout: () => void
  validatePassword: (password: string, confirm?: string) => string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setLocalSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLocalSession(getSession())
    setLoading(false)
    return subscribeSession(() => setLocalSession(getSession()))
  }, [])

  const doLogin = async (email: string, password: string) => {
    const res = await apiFetch<{
      accessToken: string
      user: { id: string; email: string; tenantId: string; isPlatformAdmin?: boolean }
    }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
    setSession({
      accessToken: res.accessToken,
      userId: res.user.id,
      email: res.user.email,
      tenantId: res.user.tenantId,
      isPlatformAdmin: res.user.isPlatformAdmin === true,
    })
  }

  const login = async (email: string, password: string) => {
    await doLogin(email, password)
  }

  const register = async (
    email: string,
    password: string,
    businessName: string | undefined,
    legalAcceptance: LegalAcceptance,
  ) => {
    const response = await apiFetch<{
      accessToken: string
      id: string
      email: string
      tenantId: string
    }>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          businessName: businessName?.trim() || undefined,
          ...legalAcceptance,
        }),
      })
    setSession({
      accessToken: response.accessToken,
      userId: response.id,
      email: response.email,
      tenantId: response.tenantId,
      isPlatformAdmin: false,
    })
  }

  const logout = () => clearSession()

  const validatePassword = (password: string, confirm?: string): string | null => {
    if (!PASSWORD_RULE.test(password)) {
      return "Senha precisa ter 8+ caracteres, com ao menos 1 letra e 1 número."
    }
    if (confirm !== undefined && password !== confirm) {
      return "As senhas não coincidem."
    }
    return null
  }

  return (
    <AuthContext.Provider value={{ session, loading, login, register, logout, validatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>")
  return ctx
}
