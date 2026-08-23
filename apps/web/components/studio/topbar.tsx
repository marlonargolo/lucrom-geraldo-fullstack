"use client"

import { Search, Bell, Command } from "lucide-react"

export function Topbar() {
  return (
    <header className="fixed left-[184px] right-0 top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-[#0d0e14]/90 px-6 backdrop-blur-sm">
      {/* Busca */}
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-white/5 px-3 py-2 text-sm text-muted-foreground">
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="flex-1 text-[13px]">Buscar projetos, peças ou mídias...</span>
        <kbd className="flex items-center gap-1 rounded border border-border bg-white/5 px-1.5 py-0.5 text-[10px]">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </div>

      {/* Notificações */}
      <button
        type="button"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white/5 text-muted-foreground transition hover:text-foreground"
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4" aria-hidden />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
      </button>
    </header>
  )
}
