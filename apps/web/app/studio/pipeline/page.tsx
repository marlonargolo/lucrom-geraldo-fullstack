"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { MODULES, ENGINES } from "@/lib/studio-data"

const MODULE_ROLES: Record<string, string> = {
  intake:       "Atendimento & Planejamento",
  roteirizacao: "Criação & Redação",
  visual:       "Direção de Arte & Produção",
  audio:        "Locução & Sound Design",
  pos:          "Edição, Color & Motion",
  qa:           "Direção de Criação & Tráfego",
}

export default function PipelinePage() {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <h1 className="mb-5 text-lg font-bold text-foreground">Pipeline em tempo real</h1>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
        {MODULES.map((mod, idx) => {
          const engines = ENGINES.filter((e) => e.module === mod.id)
          const isOpen = expanded === mod.id
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => setExpanded(isOpen ? null : mod.id)}
              className={cn(
                "w-full rounded-xl border bg-card px-5 py-4 text-left transition-all duration-200",
                isOpen
                  ? "border-primary/30 shadow-lg shadow-primary/5"
                  : "border-border hover:border-border/80 hover:shadow-sm",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold transition-colors",
                    isOpen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}>
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <p className="text-[14px] font-semibold text-foreground">{mod.name}</p>
                </div>
                <p className="text-[12px] text-muted-foreground">{MODULE_ROLES[mod.id]}</p>
              </div>

              {isOpen && (
                <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {engines.map((e) => (
                    <span
                      key={e.id}
                      className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary"
                    >
                      {e.name}
                    </span>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
