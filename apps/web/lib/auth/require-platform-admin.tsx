"use client"

// Guarda de rota do painel `/studio/admin` (equipe da plataforma).
//
// IMPORTANTE: checa `session.isPlatformAdmin` — NUNCA `role`. `role`
// ('ADMIN' | 'MEMBER') é escopo de TENANT: todo cliente que se cadastra
// nasce 'ADMIN' da própria conta (ver user.entity.ts no backend). Usar
// `role` aqui deixaria qualquer cliente entrar.
//
// A autorização de verdade é feita no backend (PlatformAdminGuard, que
// consulta `users.is_platform_admin` no banco) — este componente só evita
// renderizar a tela pra quem não tem acesso.
//
// Precisa estar DENTRO de um <AuthProvider> (app/studio/layout.tsx garante).

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "./auth-context"

export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const router = useRouter()
  const allowed = Boolean(session?.isPlatformAdmin)

  useEffect(() => {
    if (!loading && !allowed) router.replace("/studio/inicio")
  }, [loading, allowed, router])

  if (loading || !allowed) return null
  return <>{children}</>
}
