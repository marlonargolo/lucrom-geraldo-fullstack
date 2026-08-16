"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Play, Film, Clapperboard, Download, Share2, Check, CalendarClock } from "lucide-react"
import { cn } from "@/lib/utils"
import { FORMATS, BRAND_KITS, ENGINES, LAYERS } from "@/lib/studio-data"
import type { ProductionState } from "@/lib/use-production"

interface Props {
  state: ProductionState
  brandId: string
  formatId: string
}

export function ProductionPreview({ state, brandId, formatId }: Props) {
  const { status, progress, fidelity } = state
  const brand = BRAND_KITS.find((b) => b.id === brandId) ?? BRAND_KITS[0]
  const format = FORMATS.find((f) => f.id === formatId) ?? FORMATS[0]
  const done = status === "done"
  const idle = status === "idle"

  const [published, setPublished] = useState(false)

  // A peça precisa ser reproduzida antes de exportar/publicar de novo:
  // resetamos o estado de publicação sempre que sai do estado "pronto".
  useEffect(() => {
    if (status !== "done") setPublished(false)
  }, [status])

  // Aspect ratio dirigido pelo formato selecionado (9:16, 1:1, 16:9…).
  const [rw, rh] = format.ratio.split(":").map(Number)
  const portrait = rh >= rw
  const stageMaxWidth = portrait ? 240 : rw === rh ? 280 : 360

  const handleExport = () => {
    if (!done) return
    // Exporta o "master" da produção: briefing, marca, formato, camadas com
    // histórico de versões, portões de auditoria e o log de decisões.
    const doc = {
      product: "LUCROM Studio AI",
      exportedAt: new Date().toISOString(),
      brief: state.brief,
      brand: { id: brand.id, name: brand.name, voice: brand.voice, typography: brand.typography },
      format: { id: format.id, name: format.name, ratio: format.ratio, platform: format.platform },
      fidelity: state.fidelity,
      layers: LAYERS.filter((l) => state.doneLayers.includes(l.key)).map((l) => ({
        key: l.key,
        name: l.name,
        engine: l.engine,
        versions: state.layerVersions[l.key] ?? [],
      })),
      audit: {
        gates: state.gates,
        log: state.auditLog,
      },
      engines: ENGINES.map((e) => ({ id: e.id, name: e.name, status: state.engineStatus[e.id] })),
    }
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `lucrom-${brand.id}-${format.id}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handlePublish = () => {
    if (!done) return
    setPublished(true)
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Clapperboard className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="font-display text-sm font-semibold tracking-tight">Peça</h2>
        <span className="ml-auto rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          {format.name} · {format.ratio}
        </span>
      </div>

      {/* stage — aspect ratio segue o formato selecionado */}
      <div
        className="relative mx-auto w-full overflow-hidden rounded-xl border border-border bg-background transition-all duration-500"
        style={{ aspectRatio: `${rw} / ${rh}`, maxWidth: stageMaxWidth }}
      >
        <Image
          src="/preview-reel.png"
          alt="Quadro da peça publicitária gerada"
          fill
          sizes="360px"
          className={cn(
            "object-cover transition-all duration-700",
            idle && "opacity-30 grayscale",
            status === "running" && "opacity-60 blur-[1px]",
            (done || status === "review") && "opacity-100",
          )}
          priority
        />

        {/* overlay de marca */}
        {done && (
          <div className="absolute inset-0 flex flex-col justify-end p-4">
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <span
                className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: brand.palette[2]?.hex, color: brand.palette[0]?.hex }}
              >
                {brand.name}
              </span>
              <p className="mt-2 font-display text-lg font-bold leading-tight text-white text-balance">
                Sua conta. Sem tarifas. Sem letras miúdas.
              </p>
            </div>
          </div>
        )}

        {/* estado */}
        {!done && (
          <div className="absolute inset-0 flex items-center justify-center">
            {idle ? (
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground backdrop-blur">
                <Film className="h-5 w-5" aria-hidden />
              </span>
            ) : (
              <span className="flex flex-col items-center gap-2">
                <span className="font-mono text-2xl font-bold text-primary">{progress}%</span>
                <span className="text-[11px] text-muted-foreground">
                  {status === "review" ? "aguardando auditoria…" : "renderizando…"}
                </span>
              </span>
            )}
          </div>
        )}

        {done && (
          <button
            type="button"
            aria-label="Reproduzir"
            className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary/90 text-primary-foreground backdrop-blur transition-transform hover:scale-105"
          >
            <Play className="h-5 w-5 translate-x-0.5 fill-current" aria-hidden />
          </button>
        )}
      </div>

      {/* fidelidade */}
      <div className="mt-4 rounded-xl border border-border bg-background/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Fidelidade objetiva</span>
          <span
            className={cn(
              "font-mono text-sm font-bold",
              done ? "text-success" : "text-muted-foreground",
            )}
          >
            {done ? `${fidelity}%` : "—"}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn("h-full rounded-full transition-all duration-700", done ? "bg-success" : "bg-primary")}
            style={{ width: done ? `${fidelity}%` : `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          Meta: ≥ 99% de fidelidade vs. referência da marca (cor, brilho, ruído e volume).
        </p>
      </div>

      {/* formatos adaptados */}
      <div className="mt-3">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Adaptações automáticas</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FORMATS.map((f) => (
            <span
              key={f.id}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                f.id === formatId && "ring-1 ring-primary/50",
                done
                  ? "border-primary/30 bg-primary/10 text-foreground"
                  : "border-border bg-secondary text-muted-foreground/60",
              )}
            >
              {f.ratio}
            </span>
          ))}
        </div>
      </div>

      {/* confirmação de publicação */}
      {published && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 p-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
          <div>
            <p className="text-xs font-semibold text-foreground">Enviada para publicação</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {format.name} ({format.ratio}) agendada em {format.platform} · aguardando aprovação final do gestor de
              tráfego (M12).
            </p>
          </div>
        </div>
      )}

      {/* ações */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={!done}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Exportar
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={!done || published}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:brightness-105 disabled:opacity-40"
        >
          {published ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Share2 className="h-3.5 w-3.5" aria-hidden />}
          {published ? "Publicada" : "Publicar"}
        </button>
      </div>
    </section>
  )
}
