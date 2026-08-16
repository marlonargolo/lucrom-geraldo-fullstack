"use client"

import { useState } from "react"
import { Activity, Lock, Clapperboard, Network, Video, ShieldCheck, LayoutTemplate } from "lucide-react"
import { cn } from "@/lib/utils"
import { BRAND_KITS, FORMATS } from "@/lib/studio-data"
import { useProduction } from "@/lib/use-production"
import { BrandMark } from "./brand-mark"
import { BriefingComposer } from "./briefing-composer"
import { PipelineTrack } from "./pipeline-track"
import { ProductionPreview } from "./production-preview"
import { LayersPanel } from "./layers-panel"
import { AuditPanel } from "./audit-panel"
import { ArchitectureBlueprint } from "./architecture-blueprint"
import { VideoLab } from "./video-lab"
import { ConsentManager } from "./consent-manager"
import { LoginGate } from "./login-gate"
import { RealPipelinePanel } from "./real-pipeline-panel"
import { GraphicsLab } from "./graphics-lab"

type View = "studio" | "video" | "consent" | "architecture" | "real" | "graphics"

export function StudioShell() {
  const { state, start, reset, refineLayer, decideGate } = useProduction()
  const [brandId, setBrandId] = useState(BRAND_KITS[0].id)
  const [formatId, setFormatId] = useState<string>(FORMATS[0].id)
  const [view, setView] = useState<View>("studio")

  const running = state.status === "running"

  const handleProduce = (brief: string) => start(brief, brandId)
  const handleStop = () => reset()
  const handleBrandChange = (id: string) => {
    if (!running) setBrandId(id)
  }
  const handleFormatChange = (id: string) => {
    if (!running) setFormatId(id)
  }

  return (
    <div className="min-h-screen">
      <Header status={state.status} progress={state.progress} view={view} onViewChange={setView} />

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        {view === "architecture" ? (
          <ArchitectureBlueprint />
        ) : view === "video" ? (
          <VideoLab />
        ) : view === "real" ? (
          <RealPipelinePanel />
        ) : view === "graphics" ? (
          <GraphicsLab />
        ) : (
          <StudioView
            running={running}
            state={state}
            brandId={brandId}
            formatId={formatId}
            onBrandChange={handleBrandChange}
            onFormatChange={handleFormatChange}
            onProduce={handleProduce}
            onStop={handleStop}
            onRefineLayer={refineLayer}
            onDecideGate={decideGate}
          />
        )}
      </main>
    </div>
  )
}

function StudioView({
  running,
  state,
  brandId,
  formatId,
  onBrandChange,
  onFormatChange,
  onProduce,
  onStop,
  onRefineLayer,
  onDecideGate,
}: {
  running: boolean
  state: ReturnType<typeof useProduction>["state"]
  brandId: string
  formatId: string
  onBrandChange: (id: string) => void
  onFormatChange: (id: string) => void
  onProduce: (brief: string) => void
  onStop: () => void
  onRefineLayer: (key: string, note: string) => void
  onDecideGate: (gateId: string, action: "approved" | "rejected", reviewer: string) => void
}) {
  return (
    <>
      {/* headline */}
      <div className="mb-6 max-w-2xl">
        <h1 className="font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          Do briefing à peça pronta,{" "}
          <span className="text-primary">em camadas</span>, com padrão de agência.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
          Uma agência de marketing inteira operada por IA — estratégia, criação, direção de arte, produção,
          áudio, pós e auditoria. Sem cara de IA.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* coluna esquerda: briefing + pipeline */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <BriefingComposer
            running={running}
            brandId={brandId}
            onBrandChange={onBrandChange}
            formatId={formatId}
            onFormatChange={onFormatChange}
            onProduce={onProduce}
            onStop={onStop}
          />
          <PipelineTrack engineStatus={state.engineStatus} />
        </div>

        {/* coluna central: preview */}
        <div className="lg:col-span-3">
          <ProductionPreview state={state} brandId={brandId} formatId={formatId} />
        </div>

        {/* coluna direita: camadas + auditoria */}
        <div className="flex flex-col gap-4 lg:col-span-4">
          <LayersPanel
            doneLayers={state.doneLayers}
            layerVersions={state.layerVersions}
            logs={state.logs}
            onRefineLayer={onRefineLayer}
          />
          <AuditPanel
            gates={state.gates}
            auditLog={state.auditLog}
            status={state.status}
            onDecideGate={onDecideGate}
          />
        </div>
      </div>
    </>
  )
}

function Header({
  status,
  progress,
  view,
  onViewChange,
}: {
  status: string
  progress: number
  view: View
  onViewChange: (v: View) => void
}) {
  const phaseLabel =
    view === "architecture"
      ? "Fase 1 · Arquitetura"
      : view === "video"
        ? "Vídeo · Render local"
        : "Fase 0 · MVP"
  /**
   * Correção pós-auditoria (Isolamento de Tenants): a aba "Arquitetura"
   * expõe o diagrama interno do sistema — só faz sentido pra demos/uso
   * interno da equipe, não pro cliente final. Some por padrão em produção
   * a menos que explicitamente habilitada.
   */
  const showInternalViews = process.env.NEXT_PUBLIC_SHOW_INTERNAL_VIEWS === "true"
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <BrandMark />

        {/* switcher de views */}
        <nav className="ml-2 hidden items-center gap-1 rounded-full border border-border bg-card p-1 md:flex">
          <ViewTab
            active={view === "studio"}
            onClick={() => onViewChange("studio")}
            icon={Clapperboard}
            label="Estúdio"
          />
          <ViewTab
            active={view === "video"}
            onClick={() => onViewChange("video")}
            icon={Video}
            label="Vídeo"
          />
          {showInternalViews ? (
            <ViewTab
              active={view === "architecture"}
              onClick={() => onViewChange("architecture")}
              icon={Network}
              label="Arquitetura"
            />
          ) : null}
          <ViewTab
            active={view === "real"}
            onClick={() => onViewChange("real")}
            icon={ShieldCheck}
            label="Pipeline real"
          />
          <ViewTab
            active={view === "graphics"}
            onClick={() => onViewChange("graphics")}
            icon={LayoutTemplate}
            label="Peças"
          />
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* status de produção */}
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:flex">
            <Activity
              className={cn(
                "h-3.5 w-3.5",
                status === "running"
                  ? "animate-pulse text-primary"
                  : status === "review"
                    ? "animate-pulse text-warning"
                    : status === "done"
                      ? "text-success"
                      : "text-muted-foreground",
              )}
              aria-hidden
            />
            <span className="font-mono text-[11px] text-muted-foreground">
              {status === "running"
                ? `produzindo · ${progress}%`
                : status === "review"
                  ? "aguardando aprovação"
                  : status === "done"
                    ? "peça pronta"
                    : "estúdio ocioso"}
            </span>
          </div>

          {/* fase do protocolo */}
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5">
            <Lock className="h-3 w-3 text-primary" aria-hidden />
            <span className="font-mono text-[11px] font-medium text-primary">{phaseLabel}</span>
          </div>

          <LoginGate />
        </div>
      </div>
    </header>
  )
}

function ViewTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Clapperboard
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-pressed={active}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  )
}
