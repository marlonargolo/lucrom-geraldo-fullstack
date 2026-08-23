"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronLeft, Activity, Layers, ShieldCheck, Film } from "lucide-react"
import { BRAND_KITS, FORMATS, LAYERS } from "@/lib/studio-data"
import { useProduction } from "@/lib/use-production"
import { BriefingComposer } from "@/components/studio/briefing-composer"
import { PipelineTrack } from "@/components/studio/pipeline-track"
import { ProductionPreview } from "@/components/studio/production-preview"
import { AuditPanel } from "@/components/studio/audit-panel"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

type LeftTab = "briefing" | "pipeline"
type RightTab = "camadas" | "auditoria"
type MobileTab = "briefing" | "preview" | "camadas"

const LAYER_LABELS: Record<string, { name: string; desc: string }> = {
  strategy:     { name: "Estratégia",        desc: "Objetivo, público e KPI definidos" },
  concept:      { name: "Conceito",          desc: "Big idea aprovada" },
  copy:         { name: "Copy",              desc: "Headline, corpo e CTA" },
  script:       { name: "Roteiro",           desc: "5 cenas, 30s" },
  storyboard:   { name: "Storyboard",        desc: "Frames de referência" },
  artdirection: { name: "Direção de Arte",   desc: "Paleta + tipografia + grid" },
  visual:       { name: "Geração de Planos", desc: "Takes e avatares" },
  voice:        { name: "Locução",           desc: "Voz consentida" },
  audio:        { name: "Trilha & SFX",      desc: "Trilha original" },
  post:         { name: "Pós-produção",      desc: "Edição, cor e motion" },
  qa:           { name: "QA & Aprovação",    desc: "Auditoria final" },
}

function LayersList({ doneLayers }: { doneLayers: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {LAYERS.map((layer) => {
        const meta = LAYER_LABELS[layer.key] ?? { name: layer.name, desc: layer.role }
        const done = doneLayers.includes(layer.key)
        return (
          <div
            key={layer.key}
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-2.5 transition-all",
              done ? "border-primary/20 bg-primary/5" : "border-border bg-background",
            )}
          >
            <div>
              <p className={cn("text-[13px] font-semibold", done ? "text-primary" : "text-foreground")}>
                {meta.name}
              </p>
              <p className="text-[11px] text-muted-foreground">{meta.desc}</p>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="text-[11px]">v1</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function EstudioPage() {
  const { state, start, reset, refineLayer, decideGate } = useProduction()
  const [brandId, setBrandId] = useState(BRAND_KITS[0].id)
  const [formatId, setFormatId] = useState(FORMATS[0].id)
  const [leftTab, setLeftTab] = useState<LeftTab>("briefing")
  const [rightTab, setRightTab] = useState<RightTab>("camadas")
  const [mobileTab, setMobileTab] = useState<MobileTab>("briefing")
  const running = state.status === "running"

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <div className="mb-3 flex items-center gap-3">
        <Link
          href="/studio/inicio"
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <div className="ml-auto flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
          <Activity className={cn("h-3 w-3", running ? "animate-pulse text-primary" : "text-muted-foreground")} />
          <span className="font-mono text-[10px] text-muted-foreground">
            {running ? `produzindo · ${state.progress}%` : state.status === "done" ? "peça pronta" : "estúdio ocioso"}
          </span>
        </div>
      </div>

      {/* ── MOBILE: tab switcher + single column ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:hidden">
        <div className="mb-3 flex gap-1 rounded-xl border border-border bg-card p-1">
          {([
            { key: "briefing", label: "Briefing",   icon: ChevronLeft },
            { key: "preview",  label: "Prévia",     icon: Film },
            { key: "camadas",  label: "Camadas",    icon: Layers },
          ] as { key: MobileTab; label: string; icon: typeof Film }[]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMobileTab(key)}
              className={cn(
                "flex-1 rounded-lg py-2 text-[12px] font-medium transition-all",
                mobileTab === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {mobileTab === "briefing" && (
            <BriefingComposer
              running={running}
              brandId={brandId}
              onBrandChange={(id) => { if (!running) setBrandId(id) }}
              formatId={formatId}
              onFormatChange={(id) => { if (!running) setFormatId(id) }}
              onProduce={(brief) => start(brief, brandId)}
              onStop={reset}
            />
          )}
          {mobileTab === "preview" && (
            <ProductionPreview state={state} brandId={brandId} formatId={formatId} />
          )}
          {mobileTab === "camadas" && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-3 flex gap-1 rounded-lg border border-border bg-background p-1">
                {(["camadas", "auditoria"] as RightTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRightTab(t)}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-[11px] font-medium transition-all",
                      rightTab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {t === "camadas" ? "Camadas" : "Auditoria"}
                  </button>
                ))}
              </div>
              {rightTab === "camadas"
                ? <LayersList doneLayers={state.doneLayers} />
                : <AuditPanel gates={state.gates} auditLog={state.auditLog} status={state.status} onDecideGate={decideGate} />
              }
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP: 3-column layout ── */}
      <div className="hidden min-h-0 flex-1 grid-cols-[5fr_3fr_4fr] gap-4 overflow-hidden md:grid">
        {/* Esquerda */}
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {(["briefing", "pipeline"] as LeftTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setLeftTab(t)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-[12px] font-medium transition-all",
                  leftTab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "briefing" ? "Briefing" : "Linha de produção"}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {leftTab === "briefing" ? (
              <BriefingComposer
                running={running}
                brandId={brandId}
                onBrandChange={(id) => { if (!running) setBrandId(id) }}
                formatId={formatId}
                onFormatChange={(id) => { if (!running) setFormatId(id) }}
                onProduce={(brief) => start(brief, brandId)}
                onStop={reset}
              />
            ) : (
              <PipelineTrack engineStatus={state.engineStatus} />
            )}
          </div>
        </div>

        {/* Centro */}
        <div className="flex min-h-0 flex-col overflow-hidden">
          <ProductionPreview state={state} brandId={brandId} formatId={formatId} />
        </div>

        {/* Direita */}
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {(["camadas", "auditoria"] as RightTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRightTab(t)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-[12px] font-medium transition-all",
                  rightTab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "camadas" ? "Camadas" : "Auditoria"}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {rightTab === "camadas"
              ? <div className="rounded-xl border border-border bg-card p-3"><LayersList doneLayers={state.doneLayers} /></div>
              : <AuditPanel gates={state.gates} auditLog={state.auditLog} status={state.status} onDecideGate={decideGate} />
            }
          </div>
        </div>
      </div>
    </div>
  )
}
