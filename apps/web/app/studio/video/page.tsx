"use client"

import { useEffect, useState } from "react"
import { Upload, Play, Download, Loader2, AlertCircle, Film } from "lucide-react"
import { cn } from "@/lib/utils"
import { getSession } from "@/lib/auth/session-store"

interface VideoJob {
  id: string
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED"
  prompt: string
  aspect_ratio: string
  download_url: string | null
  error_message: string | null
  created_at: string
}

function useMyVideos() {
  const [videos, setVideos] = useState<VideoJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const session = getSession()
    if (!session) return

    // 1. Lista os jobs do tenant
    fetch(`/api/production/ai-video/tenant/${session.tenantId}`, {
      headers: { "X-User-Token": session.accessToken },
    })
      .then((r) => r.json())
      .then(async (data) => {
        const list: VideoJob[] = Array.isArray(data) ? data : data.jobs ?? []
        
        // 2. Para cada job DONE, busca o status completo com download_url
        const enriched = await Promise.all(
          list.map(async (v) => {
            if (v.status !== "DONE") return v
            try {
              const res = await fetch(`/api/production/ai-video/${v.id}`, {
                headers: { "X-User-Token": session.accessToken },
              })
              if (res.ok) return await res.json()
            } catch { /* noop */ }
            return v
          })
        )
        setVideos(enriched)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { videos, loading, error }
}

export default function VideoPage() {
  const { videos, loading, error } = useMyVideos()
  const [selected, setSelected] = useState<VideoJob | null>(null)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <h1 className="mb-4 text-lg font-bold text-foreground">Laboratório de Vídeo</h1>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[1fr_320px]">

        {/* Player principal */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-[13px] font-semibold text-foreground">
              {selected ? "Reproduzindo" : "Selecione um vídeo"}
            </span>
            {selected?.download_url && (
              <a
                href={selected.download_url}
                download=""
                className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[11px] text-muted-foreground transition hover:text-foreground"
              >
                <Download className="h-3 w-3" /> Baixar
              </a>
            )}
          </div>

          <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center rounded-xl border-2 border-border bg-background sm:min-h-[360px]">
            {selected?.download_url ? (
              <video
                key={selected.id}
                src={selected.download_url}
                controls
                autoPlay
                className="h-full w-full rounded-xl object-contain"
              />
            ) : selected?.status === "PROCESSING" || selected?.status === "PENDING" ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-[13px] font-medium text-foreground">Renderizando...</p>
                <p className="text-[11px] text-muted-foreground">Aguarde alguns minutos.</p>
              </div>
            ) : selected?.status === "FAILED" ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-[13px] font-medium text-destructive">Render falhou</p>
                <p className="text-[11px] text-muted-foreground">{selected.error_message}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center px-4">
                <Film className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-[13px] font-medium text-foreground">Nenhum vídeo selecionado</p>
                <p className="text-[11px] text-muted-foreground">
                  Selecione um vídeo da biblioteca ou crie um novo no Estúdio.
                </p>
              </div>
            )}
          </div>

          {selected && (
            <p className="truncate text-[11px] text-muted-foreground">
              {selected.prompt.slice(0, 120)}...
            </p>
          )}
        </div>

        {/* Biblioteca de vídeos gerados */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="text-[13px] font-semibold text-foreground">Meus vídeos</span>

          {loading ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 text-[12px] text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
            </div>
          ) : videos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Film className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-[12px] text-muted-foreground">
                Nenhum vídeo ainda. Crie um no Estúdio.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 overflow-auto">
              {videos.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelected(v)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 text-left transition-all hover:border-primary/40",
                    selected?.id === v.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-background",
                  )}
                >
                  {/* Thumbnail / status */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                    {v.status === "DONE" ? (
                      <Play className="h-4 w-4 text-primary" />
                    ) : v.status === "FAILED" ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-foreground">
                      {v.prompt.slice(0, 50)}...
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {v.aspect_ratio} · {new Date(v.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    <span className={cn(
                      "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      v.status === "DONE" ? "bg-green-500/10 text-green-500" :
                      v.status === "FAILED" ? "bg-destructive/10 text-destructive" :
                      "bg-primary/10 text-primary",
                    )}>
                      {v.status === "DONE" ? "Pronto" :
                       v.status === "FAILED" ? "Falhou" :
                       v.status === "PROCESSING" ? "Renderizando" : "Na fila"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}