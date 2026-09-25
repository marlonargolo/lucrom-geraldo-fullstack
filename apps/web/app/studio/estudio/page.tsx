"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Activity, AlertCircle, CheckCircle2, ChevronLeft, Clock, Loader2 } from "lucide-react"
import { FORMATS, LAYERS } from "@/lib/studio-data"
import type { ProductionState } from "@/lib/use-production"
import { BriefingComposer } from "@/components/studio/briefing-composer"
import { PipelineTrack } from "@/components/studio/pipeline-track"
import { ProductionPreview } from "@/components/studio/production-preview"
import { cn } from "@/lib/utils"
import { getSession } from "@/lib/auth/session-store"

type LeftTab = "briefing" | "pipeline"
type MobileTab = "briefing" | "preview" | "camadas"

const LAYER_LABELS: Record<string, string> = {
  strategy: "Estratégia", concept: "Conceito", copy: "Copy",
  script: "Roteiro", storyboard: "Storyboard", artdirection: "Direção de Arte",
  visual: "Geração de Planos", voice: "Locução", audio: "Trilha & SFX",
  post: "Pós-produção", qa: "QA & Aprovação",
}

type JobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED"
interface VideoJob { id: string; status: JobStatus; download_url: string | null; error_message: string | null }

const EMPTY_PRODUCTION_STATE: ProductionState = {
  status: "idle",
  brief: "",
  brandId: "",
  engineStatus: {} as ProductionState["engineStatus"],
  doneLayers: [],
  layerVersions: {},
  gates: {},
  auditLog: [],
  fidelity: 0,
  logs: [],
  progress: 0,
}

function useJobPolling(jobId: string | null) {
  const [job, setJob] = useState<VideoJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!jobId) return
    const session = getSession()
    if (!session) return
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`/api/production/ai-video/${jobId}`, { headers: { "X-User-Token": session.accessToken } })
        if (!res.ok) return
        const data: VideoJob = await res.json()
        if (cancelled) return
        setJob(data)
        if (data.status === "DONE" || data.status === "FAILED") {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao consultar status.")
      }
    }
    poll()
    intervalRef.current = setInterval(poll, 5000)
    return () => {
      cancelled = true
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [jobId])

  return { job, error }
}

export default function EstudioPage() {
  const [brandId, setBrandId] = useState("")
  const [formatId, setFormatId] = useState<string>(FORMATS[0]?.id ?? "")
  const [leftTab, setLeftTab] = useState<LeftTab>("briefing")
  const [mobileTab, setMobileTab] = useState<MobileTab>("briefing")
  const [renderBusy, setRenderBusy] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [showLayers, setShowLayers] = useState(false)
  const { job: videoJob, error: videoError } = useJobPolling(jobId)

  useEffect(() => {
    if (videoJob?.status === "DONE" || videoJob?.status === "FAILED") setRenderBusy(false)
  }, [videoJob?.status])

  const handleStop = () => { setRenderBusy(false); setJobId(null) }
  const handleJobCreated = (id: string) => { setJobId(id); setRenderBusy(true) }

  const statusLabel = renderBusy
    ? videoJob?.status === "PROCESSING" ? "renderizando..." : "na fila..."
    : videoJob?.status === "DONE" ? "peça pronta"
      : videoJob?.status === "FAILED" ? "falha no render"
        : "estúdio ocioso"

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mb-3 flex items-center gap-3">
        <Link href="/studio/inicio" className="flex items-center gap-1.5 text-[12px] text-muted-foreground transition hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Voltar
        </Link>
        {jobId && <button type="button" onClick={handleStop} className="text-[11px] text-muted-foreground transition hover:text-foreground">Nova produção</button>}
        <div className="ml-auto flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
          <Activity className={cn("h-3 w-3", renderBusy ? "animate-pulse text-primary" : "text-muted-foreground")} aria-hidden />
          <span className="font-mono text-[10px] text-muted-foreground">{statusLabel}</span>
        </div>
      </div>

      <div className="mb-3 flex gap-1 rounded-xl border border-border bg-card p-1 md:hidden">
        {([{ key: "briefing", label: "Briefing" }, { key: "preview", label: "Prévia" }, { key: "camadas", label: "Camadas" }] as { key: MobileTab; label: string }[]).map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setMobileTab(key)}
            className={cn("flex-1 rounded-lg py-2 text-[12px] font-medium transition-all", mobileTab === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <div className={cn("flex min-h-0 flex-col gap-3 overflow-hidden", mobileTab !== "briefing" && "hidden md:flex")}>
          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {(["briefing", "pipeline"] as LeftTab[]).map((tab) => (
              <button key={tab} type="button" onClick={() => setLeftTab(tab)}
                className={cn("flex-1 rounded-lg py-2 text-[12px] font-medium transition-all", leftTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {tab === "briefing" ? "Briefing" : "Linha de produção"}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {leftTab === "briefing" ? (
              <BriefingComposer
                running={renderBusy}
                brandId={brandId}
                onBrandChange={setBrandId}
                formatId={formatId}
                onFormatChange={(id) => setFormatId(id)}
                onProduce={() => setRenderBusy(true)}
                onStop={handleStop}
                onJobCreated={handleJobCreated}
              />
            ) : <PipelineTrack engineStatus={{}} />}
          </div>
        </div>

        <div className={cn(
          "min-h-0 overflow-auto",
          mobileTab !== "preview" && mobileTab !== "camadas" && "hidden md:block",
        )}>
          <div className={cn(mobileTab === "camadas" && "hidden md:block")}>
            {jobId ? <VideoPreview job={videoJob} error={videoError} /> : <ProductionPreview state={EMPTY_PRODUCTION_STATE} brandId={brandId} formatId={formatId} />}
          </div>

          <section className="mt-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Activity className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-foreground">Produção em camadas</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {renderBusy ? "As etapas estão sendo processadas." : "Acompanhe o pipeline sem perder o foco no briefing."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLayers((value) => !value)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {showLayers || mobileTab === "camadas" ? "Ocultar" : "Ver etapas"}
              </button>
            </div>

            {(showLayers || mobileTab === "camadas") && (
              <div className="mt-3 grid max-h-[360px] grid-cols-1 gap-1.5 overflow-auto sm:grid-cols-2">
                {LAYERS.map((layer) => {
                  const done = videoJob?.status === "DONE"
                  const processing = renderBusy
                  return (
                    <div key={layer.key} className={cn("flex items-center justify-between rounded-lg border px-3 py-2 transition-all",
                      done ? "border-primary/20 bg-primary/5" : processing ? "border-primary/10" : "border-border bg-background")}>
                      <div className="min-w-0">
                        <p className={cn("truncate text-[11px] font-semibold", done ? "text-primary" : "text-foreground")}>{LAYER_LABELS[layer.key] ?? layer.name}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{processing ? "processando..." : layer.detail}</p>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-1 text-muted-foreground">
                        {done ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden /> : processing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden /> : <><Clock className="h-3 w-3" aria-hidden /><span className="text-[10px]">v1</span></>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function VideoPreview({ job, error }: { job: VideoJob | null; error: string | null }) {
  if (error) return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
      <p className="text-[13px] font-semibold text-destructive">Erro</p>
      <p className="text-[11px] text-muted-foreground">{error}</p>
    </div>
  )
  if (!job || job.status === "PENDING" || job.status === "PROCESSING") return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <p className="text-[13px] font-semibold text-foreground">{job?.status === "PROCESSING" ? "Renderizando..." : "Na fila de render..."}</p>
      <p className="text-[11px] text-muted-foreground">Isso leva alguns minutos.</p>
    </div>
  )
  if (job.status === "DONE" && job.download_url) return (
    <div className="flex flex-col gap-3">
      <video src={job.download_url} controls className="w-full rounded-2xl border border-border" />
      <a href={job.download_url} download="" className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition hover:brightness-110">Baixar vídeo</a>
    </div>
  )
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
      <p className="text-[13px] font-semibold text-destructive">Render falhou</p>
      <p className="text-[11px] text-muted-foreground">{job.error_message ?? "Erro desconhecido."}</p>
    </div>
  )
}