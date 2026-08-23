"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Home,
  Clapperboard,
  Video,
  LayoutTemplate,
  Activity,
  ShieldCheck,
  LogOut,
  Sparkles,
  Bell,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth/auth-context"

const NAV = [
  { href: "/studio/inicio",        icon: Home,          label: "Início" },
  { href: "/studio/estudio",       icon: Clapperboard,  label: "Estúdio" },
  { href: "/studio/video",         icon: Video,         label: "Vídeo" },
  { href: "/studio/pecas",         icon: LayoutTemplate, label: "Peças" },
  { href: "/studio/pipeline",      icon: Activity,      label: "Pipeline" },
  { href: "/studio/consentimento", icon: ShieldCheck,   label: "Consentimento" },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { session, logout } = useAuth()

  const handleLogout = () => {
    logout()
    router.push("/studio/login")
  }

  const initials = session?.email?.slice(0, 1).toUpperCase() ?? "U"
  const displayName = session?.email?.split("@")[0] ?? "Usuário"

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[184px] flex-col border-r border-border bg-[#0d0e14]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" aria-hidden />
        </div>
        <div className="leading-none">
          <p className="text-[13px] font-bold tracking-tight text-foreground">Lucrom Studio</p>
          <p className="text-[10px] text-muted-foreground">Agência de IA</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 pt-3">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/studio/inicio" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Novidade */}
      <div className="mx-2 mb-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <p className="mb-0.5 text-[11px] font-semibold text-primary">Novidade no Lucrom AI</p>
        <p className="text-[11px] text-muted-foreground">Imagens com IA mais realistas.</p>
      </div>

      {/* Usuário */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[12px] font-bold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-foreground">{displayName}</p>
            <p className="text-[10px] text-muted-foreground">Plano Profissional</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Sair"
            className="text-muted-foreground transition hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  )
}
