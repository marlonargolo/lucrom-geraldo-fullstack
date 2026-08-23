"use client"

import { useState, useRef } from "react"
import { Upload, Play, Scissors, Palette, Type, Layers, Download } from "lucide-react"
import { cn } from "@/lib/utils"

const TOOLS = [
  { icon: Scissors, label: "Cortar" },
  { icon: Palette,  label: "Cor" },
  { icon: Type,     label: "Texto" },
  { icon: Layers,   label: "Camadas" },
]

const MEDIA_SLOTS = Array.from({ length: 6 })

export default function VideoPage() {
  const [hasVideo, setHasVideo] = useState(false)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <h1 className="mb-4 text-lg font-bold text-foreground">Laboratório de Vídeo</h1>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px] gap-4 overflow-hidden">
        {/* Editor */}
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-[13px] font-semibold text-foreground">Editor de vídeo</span>
            <div className="ml-auto flex gap-1">
              {TOOLS.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveTool(activeTool === label ? null : label)}
                  title={label}
                  className={cn(
                    "rounded-lg border p-2 text-muted-foreground transition-all hover:text-foreground active:scale-95",
                    activeTool === label
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background hover:border-border/60",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>

          {/* Preview area */}
          <div
            onClick={() => !hasVideo && fileRef.current?.click()}
            className={cn(
              "flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border-2 transition-all",
              hasVideo
                ? "border-border bg-black"
                : "cursor-pointer border-dashed border-border bg-background hover:border-primary/40 hover:bg-primary/5",
            )}
          >
            {hasVideo ? (
              <div className="flex h-full w-full items-center justify-center">
                <Play className="h-12 w-12 text-white/60" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-foreground">Arraste um vídeo ou clique para importar</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">MP4, MOV, WebM — até 500MB</p>
                </div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={() => setHasVideo(true)} />

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex-1 rounded-xl border border-border bg-background py-2.5 text-[13px] font-medium text-foreground transition hover:bg-accent active:scale-[0.98]"
            >
              Importar
            </button>
            <button
              type="button"
              disabled={!hasVideo}
              className="flex-1 rounded-xl bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-40 active:scale-[0.98]"
            >
              Editar
            </button>
            <button
              type="button"
              disabled={!hasVideo}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-muted-foreground transition hover:text-foreground disabled:opacity-40 active:scale-95"
              title="Exportar"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Biblioteca */}
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4">
          <span className="text-[13px] font-semibold text-foreground">Biblioteca de mídia</span>
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-auto content-start">
            {MEDIA_SLOTS.map((_, i) => (
              <div
                key={i}
                className="aspect-square cursor-pointer rounded-lg border border-border bg-background transition-all hover:border-primary/40 hover:shadow-sm active:scale-95"
              />
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="aspect-square flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-background text-muted-foreground transition hover:border-primary/40 hover:text-primary active:scale-95"
            >
              <Upload className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
