"use client"

import { Search, Bell, Command, Menu } from "lucide-react"

export function Topbar() {
  return (
    <header className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur-sm md:left-[184px] md:px-6">
      {/* Mobile logo */}
      <div className="flex items-center gap-2 md:hidden">
        <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
          <defs>
            <linearGradient id="topGrad" x1="0" y1="0" x2="64" y2="64">
              <stop offset="0%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
          <path d="M48.5 15.5C44.5 11.5 38.8 9 32 9C19.3 9 9 19.3 9 32C9 44.7 19.3 55 32 55C38.8 55 44.5 52.5 48.5 48.5L42 42C39.3 44.7 35.9 46 32 46C24.3 46 18 39.7 18 32C18 24.3 24.3 18 32 18C35.9 18 39.3 19.3 42 22L48.5 15.5Z" fill="url(#topGrad)" />
          <path d="M32 22L34.6 29.4L42 32L34.6 34.6L32 42L29.4 34.6L22 32L29.4 29.4L32 22Z" fill="white" />
        </svg>
        <span className="text-[14px] font-bold text-foreground">criatai<span className="text-primary">.</span></span>
      </div>

      {/* Search */}
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <input
          type="text"
          placeholder="Buscar projetos, peças ou mídias..."
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] sm:flex">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </div>

      <button type="button"
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        aria-label="Notificações">
        <Bell className="h-4 w-4" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
      </button>
    </header>
  )
}
