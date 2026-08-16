"use client"

import { useEffect, useState } from "react"
import { LogIn, LogOut, UserRound } from "lucide-react"
import { apiFetch, isApiConfigured, ApiError } from "@/lib/api/client"
import { getSession, setSession, clearSession, subscribeSession, type Session } from "@/lib/auth/session-store"

// Mesma regra do backend (apps/api/src/auth/dto/register.dto.ts) — validação
// client-side é só pra feedback instantâneo; o backend sempre revalida.
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

/** Extrai uma mensagem legível do corpo de erro do NestJS (class-validator costuma mandar `message` como array). */
function friendlyApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const match = err.message.match(/respondeu \d+: (.*)$/)
    if (match) {
      try {
        const parsed = JSON.parse(match[1])
        if (Array.isArray(parsed?.message)) return parsed.message.join(" ")
        if (typeof parsed?.message === "string") return parsed.message
      } catch {
        /* corpo não era JSON — usa a mensagem original abaixo */
      }
    }
    return err.message
  }
  return err instanceof Error ? err.message : "Falha inesperada."
}

/**
 * Widget de login/cadastro (POST /api/v1/auth/login e /register). Guarda o
 * JWT em `session-store.ts`; a partir daí `apiFetch` (lib/api/client.ts) já
 * anexa `X-User-Token` sozinho em toda chamada, sem exigir mudança em
 * nenhuma outra tela (briefing-composer, script-generator, voice-commands,
 * graphics, pre-flight).
 *
 * Widget compacto no header (não é uma tela de login cheia): o produto é uma
 * demo single-tenant, então um formulário inline resolve sem exigir uma
 * página nova de auth.
 *
 * Cadastro cria um Tenant novo para cada MEI (plan_tier CREATOR) — cada
 * usuário tem seu próprio tenant, nunca compartilhado. Como
 * AuthService.register não devolve token (só cria usuário + tenant), o
 * widget faz login automático em seguida com as mesmas credenciais.
 */
export function LoginGate() {
  const [session, setLocalSession] = useState<Session | null>(null)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLocalSession(getSession())
    return subscribeSession(() => setLocalSession(getSession()))
  }, [])

  if (!isApiConfigured()) return null // sem API configurada, não faz sentido oferecer login

  if (session) {
    return (
      <button
        type="button"
        onClick={() => clearSession()}
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
        title="Sair"
      >
        <UserRound className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">{session.email}</span>
        <LogOut className="h-3 w-3" aria-hidden />
      </button>
    )
  }

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    const res = await apiFetch<{ accessToken: string; user: { id: string; email: string; tenantId: string } }>(
      "/api/v1/auth/login",
      { method: "POST", body: JSON.stringify({ email: loginEmail, password: loginPassword }) },
    )
    setSession({ accessToken: res.accessToken, userId: res.user.id, email: res.user.email, tenantId: res.user.tenantId })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mode === "register") {
      if (!PASSWORD_RULE.test(password)) {
        setError("Senha precisa ter 8+ caracteres, com ao menos 1 letra e 1 número.")
        return
      }
      if (password !== confirmPassword) {
        setError("As senhas não coincidem.")
        return
      }
    }

    setLoading(true)
    try {
      if (mode === "register") {
        await apiFetch("/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password, businessName: businessName.trim() || undefined }),
        })
        // Cadastro não devolve token (ver AuthService.register) — login
        // automático em seguida pra já entrar direto, sem passo extra.
        await doLogin(email, password)
      } else {
        await doLogin(email, password)
      }
      setOpen(false)
      setPassword("")
      setConfirmPassword("")
    } catch (err) {
      setError(friendlyApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
      >
        <LogIn className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Entrar</span>
      </button>

      {open && (
        <form
          onSubmit={submit}
          className="absolute right-0 top-10 z-30 w-64 rounded-xl border border-border bg-card p-3 shadow-lg"
        >
          <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            {mode === "login" ? "Login necessário para IA (custo real)" : "Criar conta — MEI"}
          </p>
          {mode === "register" && (
            <input
              type="text"
              placeholder="nome do negócio (opcional)"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
          )}
          <input
            type="email"
            required
            placeholder="e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          />
          <input
            type="password"
            required
            placeholder="senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          />
          {mode === "register" && (
            <input
              type="password"
              required
              placeholder="confirmar senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
          )}
          {error && <p className="mb-2 text-[10px] text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {loading ? (mode === "login" ? "Entrando…" : "Criando conta…") : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "login" ? "register" : "login"))
              setError(null)
            }}
            className="mt-2 w-full text-center text-[10px] text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            {mode === "login" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
          </button>
        </form>
      )}
    </div>
  )
}
