"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Home, Clapperboard, Video, LayoutTemplate, Activity, ShieldCheck, LogOut, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth/auth-context"

const NAV = [
  { href: "/studio/inicio",        Icon: Home,           label: "Início" },
  { href: "/studio/estudio",       Icon: Clapperboard,   label: "Estúdio" },
  { href: "/studio/video",         Icon: Video,          label: "Vídeo" },
  { href: "/studio/pecas",         Icon: LayoutTemplate, label: "Peças" },
  { href: "/studio/pipeline",      Icon: Activity,       label: "Pipeline" },
  { href: "/studio/consentimento", Icon: ShieldCheck,    label: "Consentimento" },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { session, logout } = useAuth()

  const handleLogout = () => { logout(); router.push("/studio/login") }
  const initials = session?.email?.slice(0, 1).toUpperCase() ?? "U"
  const displayName = session?.email?.split("@")[0] ?? "Usuário"

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[184px] flex-col border-r border-border bg-card md:flex">
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
          <svg width="28" height="28" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="sbGrad" x1="0" y1="0" x2="64" y2="64">
                <stop offset="0%" stopColor="#A855F7" />
                <stop offset="100%" stopColor="#7C3AED" />
              </linearGradient>
            </defs>
            <path d="M48.5 15.5C44.5 11.5 38.8 9 32 9C19.3 9 9 19.3 9 32C9 44.7 19.3 55 32 55C38.8 55 44.5 52.5 48.5 48.5L42 42C39.3 44.7 35.9 46 32 46C24.3 46 18 39.7 18 32C18 24.3 24.3 18 32 18C35.9 18 39.3 19.3 42 22L48.5 15.5Z" fill="url(#sbGrad)" />
            <path d="M32 22L34.6 29.4L42 32L34.6 34.6L32 42L29.4 34.6L22 32L29.4 29.4L32 22Z" fill="white" />
          </svg>
          <div className="leading-none">
            <p className="text-[14px] font-bold tracking-tight text-foreground">
              criatai<span className="text-primary">.</span>
            </p>
            <p className="text-[10px] text-muted-foreground">Agência de IA</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 pt-3">
          {NAV.map(({ href, Icon, label }) => {
            const active = pathname === href || (href !== "/studio/inicio" && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="mx-2 mb-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-primary" />
            <p className="text-[11px] font-semibold text-primary">Novidade no Lucrom AI</p>
          </div>
          <p className="text-[11px] text-muted-foreground">Imagens com IA mais realistas.</p>
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[12px] font-bold text-primary ring-2 ring-primary/10">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-foreground">{displayName}</p>
              <p className="text-[10px] text-muted-foreground">Plano Profissional</p>
            </div>
            <button type="button" onClick={handleLogout} title="Sair"
              className="rounded-md p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-card md:hidden">
        {NAV.slice(0, 5).map(({ href, Icon, label }) => {
          const active = pathname === href || (href !== "/studio/inicio" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
