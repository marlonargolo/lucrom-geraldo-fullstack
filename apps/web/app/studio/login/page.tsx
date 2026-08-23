"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, LogIn, UserPlus, Eye, EyeOff, TriangleAlert } from "lucide-react"
import { BrandMark } from "@/components/studio/brand-mark"
import { useAuth } from "@/lib/auth/auth-context"
import { friendlyApiError } from "@/lib/auth/auth-context"
import { isApiConfigured } from "@/lib/api/client"
import { cn } from "@/lib/utils"

type Mode = "login" | "register"

export default function LoginPage() {
  const { session, login, register, validatePassword } = useAuth()
  const router = useRouter()

  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Redireciona se já logado
  useEffect(() => {
    if (session) router.replace("/studio")
  }, [session, router])

  // Sem API configurada no servidor, mostra aviso em vez de formulário
  const apiUnavailable = !process.env.NEXT_PUBLIC_API_BASE_URL

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mode === "register") {
      const err = validatePassword(password, confirmPassword)
      if (err) { setError(err); return }
    }

    setLoading(true)
    try {
      if (mode === "register") {
        await register(email, password, businessName)
      } else {
        await login(email, password)
      }
      router.replace("/studio")
    } catch (err) {
      setError(friendlyApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Fundo decorativo */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/5">
          {/* Tabs */}
          <div className="mb-6 flex items-center gap-1 rounded-xl border border-border bg-background/60 p-1">
            <TabBtn
              active={mode === "login"}
              onClick={() => { setMode("login"); setError(null) }}
              icon={LogIn}
              label="Entrar"
            />
            <TabBtn
              active={mode === "register"}
              onClick={() => { setMode("register"); setError(null) }}
              icon={UserPlus}
              label="Criar conta"
            />
          </div>

          {/* API indisponível */}
          {apiUnavailable && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Backend não configurado. Defina{" "}
                <code className="rounded bg-warning/10 px-1">NEXT_PUBLIC_API_BASE_URL</code> e{" "}
                <code className="rounded bg-warning/10 px-1">API_TOKEN</code> no{" "}
                <code className="rounded bg-warning/10 px-1">.env.local</code>.
              </span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <Field label="Nome do negócio (opcional)">
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ex.: Hamburgueria do João"
                  autoComplete="organization"
                  className={inputClass}
                />
              </Field>
            )}

            <Field label="E-mail">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete={mode === "login" ? "username" : "email"}
                className={inputClass}
              />
            </Field>

            <Field label="Senha">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "8+ caracteres, letras e números" : "••••••••"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className={cn(inputClass, "pr-10")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {mode === "register" && (
              <Field label="Confirmar senha">
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                    className={cn(inputClass, "pr-10")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || apiUnavailable}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {loading
                ? mode === "login" ? "Entrando…" : "Criando conta…"
                : mode === "login" ? "Entrar no estúdio" : "Criar conta e entrar"}
            </button>
          </form>

          {mode === "register" && (
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Cada conta cria um workspace próprio — seus dados nunca são compartilhados.
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          LUCROM Studio AI · Fase 0 MVP · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof LogIn
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
      aria-pressed={active}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
