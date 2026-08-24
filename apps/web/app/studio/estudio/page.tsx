"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronLeft, Activity, Clock, Loader2, CheckCircle2, AlertCircle, Film, Layers } from "lucide-react"
import { BRAND_KITS, FORMATS, LAYERS } from "@/lib/studio-data"
import { useRealProduction } from "@/lib/production/use-real-production"
import { useAiVideoStatus } from "@/lib/production/use-ai-video-status"
import { BriefingComposer } from "@/components/studio/briefing-composer"
import { PipelineTrack } from "@/components/studio/pipeline-track"
import { ProductionPreview } from "@/components/studio/production-preview"
import { cn } from "@/lib/utils"

type LeftTab = "briefing" | "pipeline"
type MobileTab = "briefing" | "preview" | "camadas"

const STAGE_ORDER = ["CREATED", "BUSINESS", "STRATEGY", "CREATIVE", "PRODUCTION", "QUALITY", "DONE"]

const LAYER_META: Record<string, { name: string; desc: string; stageRequired: string }> = {
  strategy:     { name: "Estratégia",        desc: "Objetivo, público e KPI definidos",  stageRequired: "BUSINESS" },
  concept:      { name: "Conceito",          desc: "Big idea aprovada",                   stageRequired: "STRATEGY" },
  copy:         { name: "Copy",              desc: "Headline, corpo e CTA",               stageRequired: "STRATEGY" },
  script:       { name: "Roteiro",           desc: "5 cenas, 30s",                        stageRequired: "STRATEGY" },
  storyboard:   { name: "Storyboard",        desc: "Frames de referência",                stageRequired: "CREATIVE" },
  artdirection: { name: "Direção de Arte",   desc: "Paleta + tipografia + grid",          stageRequired: "CREATIVE" },
  visual:       { name: "Geração de Planos", desc: "Takes e avatares",                    stageRequired: "CREATIVE" },
  voice:        { name: "Locução",           desc: "Voz consentida",                      stageRequired: "PRODUCTION" },
  audio:        { name: "Trilha & SFX",      desc: "Trilha original",                     stageRequired: "PRODUCTION" },
  post:         { name: "Pós-produção",      desc: "Edição, cor e motion",                stageRequired: "PRODUCTION" },
  qa:           { name: "QA & Aprovação",    desc: "Auditoria final",                     stageRequired: "DONE" },
}

function stageReached(current: string, required: string): boolean {
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(required)
}

export default function EstudioPage() {
  const prod = useRealProduction()
  const [brandId, setBrandId] = useState(BRAND_KITS[0].id)
  const [formatId, setFormatId] = useState(FORMATS[0].id)
  const [leftTab, setLeftTab] = useState<LeftTab>("briefing")
  const [mobileTab, setMobileTab] = useState<MobileTab>("briefing")

  const stage = prod.session?.current_stage ?? "CREATED"
  const inProduction = ["PRODUCTION", "QUALITY", "DONE"].includes(stage)
  const busy = prod.busy

  // Poll de vídeo apenas quando em produção
  const { job: videoJob, dispatchFailed, error: videoError } = useAiVideoStatus(
    prod.session?.id,
    inProduction,
  )

  // onProduce: cria sessão no Director Engine e dispara business engine
  // com o brief como problemDescription
  const handleProduce = async (brief: string) => {
    const s = await prod.createSession(brandId).catch(() => null)
    if (!s) return
    await prod.advanceBusiness({
      brandId,
      problemCategory: "LOW_AWARENESS",
      problemDescription: brief,
      targetMetric: "engajamento",
    })
  }

  const handleStop = () => prod.reset()

  // Camadas derivadas do stage real
  const doneLayers = LAYERS
    .filter((l) => {
      const meta = LAYER_META[l.key]
      return meta && stageReached(stage, meta.stageRequired)
    })
    .map((l) => l.key)

  // Status de produção para o header
  const statusLabel = busy
    ? "processando..."
    : stage === "DONE" ? "peça pronta"
    : stage === "ABORTED" ? "abortado"
    : stage === "CREATED" ? "estúdio ocioso"
    : `etapa: ${stage.toLowerCase()}`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <div className="mb-3 flex items-center gap-3">
        <Link href="/studio/inicio"
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground transition hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <div className="ml-auto flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
          <Activity className={cn("h-3 w-3", busy ? "animate-pulse text-primary" : "text-muted-foreground")} />
          <span className="font-mono text-[10px] text-muted-foreground">{statusLabel}</span>
        </div>
      </div>

      {/* Erro do useRealProduction */}
      {prod.error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {prod.error}
        </div>
      )}

      {/* Abortado */}
      {stage === "ABORTED" && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {prod.session?.abort_reason ?? "Produção abortada pelo Business Engine."}
          <button type="button" onClick={prod.reset}
            className="ml-auto shrink-0 rounded-md border border-destructive/30 px-2 py-0.5 text-[11px] hover:bg-destructive/10">
            Recomeçar
          </button>
        </div>
      )}

      {/* Mobile tabs */}
      <div className="mb-3 flex gap-1 rounded-xl border border-border bg-card p-1 md:hidden">
        {([
          { key: "briefing", label: "Briefing" },
          { key: "preview",  label: "Prévia" },
          { key: "camadas",  label: "Camadas" },
        ] as { key: MobileTab; label: string }[]).map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setMobileTab(key)}
            className={cn("flex-1 rounded-lg py-2 text-[12px] font-medium transition-all",
              mobileTab === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {/* 3-column desktop / tabbed mobile */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[5fr_3fr_4fr]">

        {/* Esquerda: Briefing / Pipeline */}
        <div className={cn("flex min-h-0 flex-col gap-3 overflow-hidden",
          mobileTab !== "briefing" && "hidden md:flex")}>
          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {(["briefing", "pipeline"] as LeftTab[]).map((t) => (
              <button key={t} type="button" onClick={() => setLeftTab(t)}
                className={cn("flex-1 rounded-lg py-2 text-[12px] font-medium transition-all",
                  leftTab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {t === "briefing" ? "Briefing" : "Linha de produção"}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {leftTab === "briefing" ? (
              <BriefingComposer
                running={busy}
                brandId={brandId}
                onBrandChange={(id) => { if (!busy) setBrandId(id) }}
                formatId={formatId}
                onFormatChange={(id) => { if (!busy) setFormatId(id) }}
                onProduce={handleProduce}
                onStop={handleStop}
              />
            ) : (
              <PipelineTrack engineStatus={{}} />
            )}
          </div>
        </div>

        {/* Centro: Preview */}
        <div className={cn("flex min-h-0 flex-col overflow-hidden",
          mobileTab !== "preview" && "hidden md:flex")}>
          {inProduction && videoJob ? (
            <VideoPreview job={videoJob} dispatchFailed={dispatchFailed} error={videoError} />
          ) : (
            <ProductionPreview
              state={{
                status: busy ? "running" : stage === "DONE" ? "done" : "idle",
                progress: stageProgress(stage),
                doneLayers,
                layerVersions: {},
                logs: [],
                gates: [],
                auditLog: [],
                engineStatus: {},
              }}
              brandId={brandId}
              formatId={formatId}
            />
          )}
        </div>

        {/* Direita: Camadas */}
        <div className={cn("flex min-h-0 flex-col gap-3 overflow-hidden",
          mobileTab !== "camadas" && "hidden md:flex")}>
          <div className="rounded-xl border border-border bg-card p-1">
            <div className="rounded-lg bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground text-center">
              Camadas
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3">
              {LAYERS.map((layer) => {
                const meta = LAYER_META[layer.key]
                const done = doneLayers.includes(layer.key)
                const inProgress = !done && busy && meta && stageReached(stage, meta.stageRequired)
                return (
                  <div key={layer.key}
                    className={cn("flex items-center justify-between rounded-lg border px-3 py-2.5 transition-all",
                      done ? "border-primary/20 bg-primary/5" :
                      inProgress ? "border-primary/10 bg-primary/3" :
                      "border-border bg-background")}>
                    <div>
                      <p className={cn("text-[13px] font-semibold",
                        done ? "text-primary" : "text-foreground")}>
                        {meta?.name ?? layer.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {done ? (meta?.desc ?? layer.role) : inProgress ? "processando..." : meta?.desc ?? layer.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      {done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      ) : inProgress ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      ) : (
                        <><Clock className="h-3 w-3" /><span className="text-[11px]">v1</span></>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Video preview quando em produção ─────────────────────────────────────────
function VideoPreview({
  job, dispatchFailed, error,
}: {
  job: { status: string; download_url: string | null; error_message: string | null } | null
  dispatchFailed: boolean
  error: string | null
}) {
  if (dispatchFailed || error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-[13px] font-semibold text-destructive">Falha no dispatch</p>
        <p className="text-[11px] text-muted-foreground">{error ?? "O job de render não foi criado."}</p>
      </div>
    )
  }
  if (!job || job.status === "PENDING" || job.status === "PROCESSING") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-[13px] font-semibold text-foreground">
          {job?.status === "PROCESSING" ? "Renderizando..." : "Na fila de render..."}
        </p>
        <p className="text-[11px] text-muted-foreground">Isso leva alguns minutos.</p>
      </div>
    )
  }
  if (job.status === "DONE" && job.download_url) {
    return (
      <div className="flex flex-col gap-3">
        <video src={job.download_url} controls className="w-full rounded-2xl border border-border" />
        <a href={job.download_url} download=""
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition hover:brightness-110">
          Baixar vídeo
        </a>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertCircle className="h-6 w-6 text-destructive" />
      <p className="text-[13px] font-semibold text-destructive">Render falhou</p>
      <p className="text-[11px] text-muted-foreground">{job.error_message ?? "Erro desconhecido."}</p>
    </div>
  )
}

function stageProgress(stage: string): number {
  const idx = STAGE_ORDER.indexOf(stage)
  if (idx < 0) return 0
  return Math.round((idx / (STAGE_ORDER.length - 1)) * 100)
}