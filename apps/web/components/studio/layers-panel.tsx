"use client"

import { useState } from "react"
import { Layers, Check, GitBranch, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { LAYERS } from "@/lib/studio-data"
import type { LogEntry, LayerVersion } from "@/lib/use-production"

interface Props {
  doneLayers: string[]
  layerVersions: Record<string, LayerVersion[]>
  logs: LogEntry[]
  onRefineLayer: (key: string, note: string) => void
}

export function LayersPanel({ doneLayers, layerVersions, logs, onRefineLayer }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [note, setNote] = useState("")

  const submitRefine = (key: string) => {
    onRefineLayer(key, note)
    setNote("")
    setOpenKey(null)
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="font-display text-sm font-semibold tracking-tight">Camadas de produção</h2>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {doneLayers.length}/{LAYERS.length}
        </span>
      </div>

      {/* stack de camadas versionadas */}
      <ol className="flex flex-col gap-1">
        {LAYERS.map((l, idx) => {
          const done = doneLayers.includes(l.key)
          const history = layerVersions[l.key] ?? []
          const current = history[history.length - 1]
          const isOpen = openKey === l.key
          return (
            <li
              key={l.key}
              className={cn(
                "rounded-lg border px-3 py-2 transition-all",
                done ? "border-primary/25 bg-primary/5" : "border-border bg-background/40",
              )}
              style={{ marginLeft: `${Math.min(idx, 6) * 3}px` }}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[10px]",
                    done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3 w-3" aria-hidden /> : idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <span className={cn("text-xs font-medium", done ? "text-foreground" : "text-muted-foreground")}>
                    {l.name}
                  </span>
                  <span className="ml-2 text-[11px] text-muted-foreground/70">{l.detail}</span>
                </div>
                {done && current ? (
                  <span className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">
                    <GitBranch className="h-2.5 w-2.5" aria-hidden />v{current.version}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-muted-foreground/60">{l.engine}</span>
                )}
                {done && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenKey(isOpen ? null : l.key)
                      setNote("")
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={`Refinar camada ${l.name}`}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? <X className="h-3 w-3" aria-hidden /> : <Plus className="h-3 w-3" aria-hidden />}
                  </button>
                )}
              </div>

              {/* histórico de versões + form de refino */}
              {done && isOpen && (
                <div className="mt-2 border-t border-border/60 pt-2">
                  <ul className="mb-2 flex flex-col gap-1">
                    {history.map((v) => (
                      <li key={v.version} className="flex items-center gap-2 text-[10px]">
                        <span className="w-6 shrink-0 font-mono text-primary">v{v.version}</span>
                        <span
                          className={cn(
                            "rounded px-1 py-0.5 font-mono",
                            v.source === "human" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {v.source === "human" ? "humano" : "auto"}
                        </span>
                        <span className="truncate text-muted-foreground">{v.note}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) submitRefine(l.key)
                      }}
                      placeholder="Nota do refino (ex.: encurtar o CTA)"
                      className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => submitRefine(l.key)}
                      className="shrink-0 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      Nova versão
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {/* logs de bastidor */}
      <div className="mt-4">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Bastidor</span>
        <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border bg-background/60 p-2.5">
          {logs.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-muted-foreground/60">
              A produção aparece aqui, motor a motor.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {logs.map((log) => (
                <li key={log.id} className="flex gap-2 text-[11px] leading-snug">
                  <span className="shrink-0 font-mono text-primary">{log.engine}</span>
                  <span className="text-muted-foreground">
                    <span className="text-foreground/80">{log.role}:</span> {log.msg}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
