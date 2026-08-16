"use client"

import { useState } from "react"
import { Pencil, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { VideoGenerator } from "./video-generator"
import { VideoEditor } from "./video-editor"

type Mode = "create" | "edit"

export function VideoLab() {
  const [mode, setMode] = useState<Mode>("create")

  return (
    <>
      <div className="mb-6 max-w-2xl">
        <h1 className="font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          Vídeo de verdade, <span className="text-primary">100% no navegador</span>.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
          Crie vídeos a partir de qualquer conteúdo ou edite um vídeo enviado — corte, cor, textos e marca. Tudo
          renderizado e exportado localmente, sem APIs de terceiros.
        </p>
      </div>

      {/* alternador Criar / Editar */}
      <div className="mb-5 inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
        <ModeTab active={mode === "create"} onClick={() => setMode("create")} icon={Wand2} label="Criar vídeo" />
        <ModeTab active={mode === "edit"} onClick={() => setMode("edit")} icon={Pencil} label="Editar vídeo" />
      </div>

      {mode === "create" ? <VideoGenerator /> : <VideoEditor />}
    </>
  )
}

function ModeTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Wand2
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors sm:text-sm",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
      aria-pressed={active}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  )
}
