"use client"

import { Check, Loader2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { ENGINES, MODULES, type ModuleId } from "@/lib/studio-data"
import type { EngineStatus } from "@/lib/use-production"

interface Props {
  engineStatus: Record<string, EngineStatus>
}

export function PipelineTrack({ engineStatus }: Props) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="font-display text-sm font-semibold tracking-tight">Linha de produção</h2>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">13 motores · 6 módulos</span>
      </div>

      <div className="flex flex-col gap-4">
        {MODULES.map((mod) => (
          <ModuleGroup key={mod.id} moduleId={mod.id} engineStatus={engineStatus} />
        ))}
      </div>
    </section>
  )
}

function ModuleGroup({
  moduleId,
  engineStatus,
}: {
  moduleId: ModuleId
  engineStatus: Record<string, EngineStatus>
}) {
  const mod = MODULES.find((m) => m.id === moduleId)!
  const engines = ENGINES.filter((e) => e.module === moduleId)
  const active = engines.some((e) => engineStatus[e.id] === "active")
  const allDone = engines.every((e) => engineStatus[e.id] === "done")

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-md font-mono text-[10px] font-semibold",
            allDone
              ? "bg-success/15 text-success"
              : active
                ? "bg-primary/15 text-primary"
                : "bg-secondary text-muted-foreground",
          )}
        >
          {mod.index}
        </span>
        <span className="text-xs font-semibold text-foreground">{mod.name}</span>
        <span className="text-[11px] text-muted-foreground">· {mod.role}</span>
      </div>

      <div className="ml-2.5 flex flex-col gap-1.5 border-l border-border pl-4">
        {engines.map((e) => {
          const status = engineStatus[e.id] ?? "pending"
          return (
            <div
              key={e.id}
              className={cn(
                "flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors",
                status === "active" && "bg-primary/10",
                status === "done" && "opacity-90",
              )}
            >
              <StatusIcon status={status} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{e.id}</span>
                  <span
                    className={cn(
                      "truncate text-xs font-medium",
                      status === "pending" ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {e.name}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-0.5 text-[11px] leading-snug",
                    status === "active" ? "text-muted-foreground" : "text-muted-foreground/70",
                  )}
                >
                  substitui: {e.role}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: EngineStatus }) {
  if (status === "done")
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
        <Check className="h-2.5 w-2.5" aria-hidden />
      </span>
    )
  if (status === "active")
    return <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
  return <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden />
}
