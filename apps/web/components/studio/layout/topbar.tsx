"use client"

import { Search, Bell, Command } from "lucide-react"

export function Topbar() {
  return (
    <header className="fixed left-[184px] right-0 top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-card/90 px-6 backdrop-blur-sm">
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <input
          type="text"
          placeholder="Buscar projetos, peças ou mídias..."
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
        <kbd className="flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </div>
      <button
        type="button"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
      </button>
    </header>
  )
}
