"use client"

import { useEffect, useState } from "react"
import { Loader2, TriangleAlert, CheckCircle2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRealProduction } from "@/lib/production/use-real-production"
import { useAiVideoStatus } from "@/lib/production/use-ai-video-status"
import {
  BUSINESS_PROBLEM_CATEGORIES,
  STRATEGY_ANGLES,
  PSYCHOLOGICAL_APPROACHES,
  PRIMARY_CHANNELS,
  DESIRED_EMOTIONS,
  CTA_TYPES,
  type ProjectStage,
} from "@/lib/production/real-production-client"
import { brandClient, type BrandKit } from "@/lib/production/brand-client"

const STAGES: ProjectStage[] = ["CREATED", "BUSINESS", "STRATEGY", "CREATIVE", "PRODUCTION"]

const STAGE_LABELS: Record<ProjectStage, string> = {
  CREATED: "Sessão criada",
  BUSINESS: "Vale a pena produzir?",
  STRATEGY: "Estratégia definida",
  CREATIVE: "Roteiro gerado",
  PRODUCTION: "Vídeo em geração (Kling/MiniMax)",
  QUALITY: "Qualidade",
  DONE: "Concluído",
  ABORTED: "Abortado",
}

export function RealPipelinePanel() {
  const rp = useRealProduction()
  const [brands, setBrands] = useState<BrandKit[] | null>(null)
  const [selectedBrand, setSelectedBrand] = useState("")
  const [newBrandName, setNewBrandName] = useState("")
  const [brandError, setBrandError] = useState<string | null>(null)

  useEffect(() => {
    brandClient
      .list()
      .then((list) => {
        setBrands(list)
        if (list[0]) setSelectedBrand(list[0].id)
      })
      .catch(() => setBrands([]))
  }, [])

  const createBrand = async () => {
    if (!newBrandName.trim()) return
    setBrandError(null)
    try {
      const kit = await brandClient.create(newBrandName.trim())
      setBrands((prev) => [...(prev ?? []), kit])
      setSelectedBrand(kit.id)
      setNewBrandName("")
    } catch (e) {
      setBrandError(e instanceof Error ? e.message : "Falha ao criar marca.")
    }
  }

  const stage = rp.session?.current_stage ?? null
  const stageIndex = stage ? STAGES.indexOf(stage) : -1
  const videoStatus = useAiVideoStatus(rp.session?.id, stage === "PRODUCTION")

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-display text-sm font-semibold tracking-tight">Pipeline real (Director Engine)</h2>
      </div>
      <p className="mb-4 text-[11px] leading-snug text-muted-foreground">
        Diferente do painel de simulação: cada etapa aqui chama o backend de verdade — Business, Strategy, Creative
        e Production Engines reais, com decisões e IDs persistidos no banco.
      </p>

      {/* Timeline de estágio real */}
      {rp.session && (
        <div className="mb-4 flex items-center gap-1 overflow-x-auto pb-1">
          {STAGES.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <span
                className={cn(
                  "whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium",
                  stage === "ABORTED"
                    ? "bg-destructive/10 text-destructive"
                    : i <= stageIndex
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground",
                )}
              >
                {STAGE_LABELS[s]}
              </span>
              {i < STAGES.length - 1 && <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />}
            </div>
          ))}
        </div>
      )}

      {rp.error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {rp.error}
        </div>
      )}

      {/* Etapa 0 — escolher/criar marca e criar sessão */}
      {!rp.session && (
        <div className="space-y-3">
          {brands === null ? (
            <p className="text-[11px] text-muted-foreground">Carregando marcas...</p>
          ) : (
            <>
              {brands.length > 0 && (
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <input
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="ou crie uma marca nova: nome do negócio"
                  className="flex-1 rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={createBrand}
                  className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
                >
                  Criar marca
                </button>
              </div>
              {brandError && <p className="text-[11px] text-destructive">{brandError}</p>}
              <button
                type="button"
                disabled={!selectedBrand || rp.busy}
                onClick={() => rp.createSession(selectedBrand)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                {rp.step === "creating" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Iniciar sessão real
              </button>
            </>
          )}
        </div>
      )}

      {stage === "CREATED" && <BusinessForm brandId={rp.session!.brand_id} onSubmit={rp.advanceBusiness} busy={rp.busy} />}
      {stage === "BUSINESS" && (
        <StrategyForm businessTicketId={rp.session!.business_ticket_id!} onSubmit={rp.advanceStrategy} busy={rp.busy} />
      )}
      {stage === "STRATEGY" && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Aciona o Creative Engine real — chama a API da Anthropic pra redigir o roteiro. Requer{" "}
            <code className="rounded bg-secondary px-1">LLM_API_KEY</code> configurada no backend.
          </p>
          <button
            type="button"
            disabled={rp.busy}
            onClick={() => rp.advanceCreative()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {rp.step === "creative" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Gerar roteiro (Creative Engine)
          </button>
        </div>
      )}
      {stage === "CREATIVE" && (
        <button
          type="button"
          disabled={rp.busy}
          onClick={() => rp.advanceProduction()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {rp.step === "production" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Gerar contrato de produção
        </button>
      )}
      {stage === "PRODUCTION" && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-[12px]">
          {videoStatus.dispatchFailed && (
            <div className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
              O disparo da geração falhou antes de criar o job (contrato: {rp.session?.render_job_id}).
            </div>
          )}
          {videoStatus.error && (
            <div className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
              {videoStatus.error}
            </div>
          )}
          {!videoStatus.dispatchFailed && !videoStatus.error && !videoStatus.job && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              Localizando o job de geração…
            </div>
          )}
          {videoStatus.job?.status === "PENDING" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              Vídeo na fila ({videoStatus.job.provider === "kling" ? "Kling" : "MiniMax"}).
            </div>
          )}
          {videoStatus.job?.status === "PROCESSING" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              Gerando vídeo com {videoStatus.job.provider === "kling" ? "Kling" : "MiniMax"}… isso pode levar alguns minutos.
            </div>
          )}
          {videoStatus.job?.status === "FAILED" && (
            <div className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
              Geração falhou: {videoStatus.job.error_message ?? "erro desconhecido no provedor."}
            </div>
          )}
          {videoStatus.job?.status === "DONE" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                Vídeo pronto ({videoStatus.job.provider === "kling" ? "Kling" : "MiniMax"}).
              </div>
              {videoStatus.job.download_url && (
                <video src={videoStatus.job.download_url} controls className="w-full max-w-xs rounded-lg" />
              )}
            </div>
          )}
        </div>
      )}
      {stage === "ABORTED" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
          {rp.session?.abort_reason}
        </div>
      )}

      {rp.session && (
        <button type="button" onClick={rp.reset} className="mt-4 text-[11px] text-muted-foreground underline-offset-2 hover:underline">
          Começar nova sessão
        </button>
      )}
    </div>
  )
}

function BusinessForm({
  brandId,
  onSubmit,
  busy,
}: {
  brandId: string
  onSubmit: (input: Parameters<ReturnType<typeof useRealProduction>["advanceBusiness"]>[0]) => void
  busy: boolean
}) {
  const [problemCategory, setProblemCategory] = useState<(typeof BUSINESS_PROBLEM_CATEGORIES)[number]>(
    BUSINESS_PROBLEM_CATEGORIES[0],
  )
  const [problemDescription, setProblemDescription] = useState("")
  const [targetMetric, setTargetMetric] = useState("")
  const [currentValue, setCurrentValue] = useState("")
  const [targetValue, setTargetValue] = useState("")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ brandId, problemCategory, problemDescription, targetMetric, currentValue, targetValue })
      }}
      className="space-y-2"
    >
      <select
        value={problemCategory}
        onChange={(e) => setProblemCategory(e.target.value as typeof problemCategory)}
        className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
      >
        {BUSINESS_PROBLEM_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <textarea
        value={problemDescription}
        onChange={(e) => setProblemDescription(e.target.value)}
        placeholder="Descreva o problema real de negócio (quanto mais detalhado, melhor a decisão do motor)"
        rows={3}
        required
        maxLength={4000}
        className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
      />
      <input
        value={targetMetric}
        onChange={(e) => setTargetMetric(e.target.value)}
        placeholder="Métrica de sucesso (ex.: visitas_semanais)"
        required
        maxLength={200}
        className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <input
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          placeholder="Valor atual (opcional)"
          maxLength={200}
          className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
        />
        <input
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          placeholder="Meta (opcional)"
          maxLength={200}
          className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Sem meta mensurável e descrição curta, o motor pode decidir ABORT — é uma regra real, não decoração.
      </p>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Avaliar (Business Engine)
      </button>
    </form>
  )
}

function StrategyForm({
  businessTicketId,
  onSubmit,
  busy,
}: {
  businessTicketId: string
  onSubmit: (input: Parameters<ReturnType<typeof useRealProduction>["advanceStrategy"]>[0]) => void
  busy: boolean
}) {
  const [manifestDesire, setManifestDesire] = useState("")
  const [hiddenFear, setHiddenFear] = useState("")
  const [culturalContradiction, setCulturalContradiction] = useState("")
  const [coreThesis, setCoreThesis] = useState("")
  const [angle, setAngle] = useState<(typeof STRATEGY_ANGLES)[number]>(STRATEGY_ANGLES[0])
  const [psychologicalApproach, setPsychologicalApproach] = useState<(typeof PSYCHOLOGICAL_APPROACHES)[number]>(
    PSYCHOLOGICAL_APPROACHES[0],
  )
  const [primaryChannel, setPrimaryChannel] = useState<(typeof PRIMARY_CHANNELS)[number]>(PRIMARY_CHANNELS[0])
  const [desiredEmotion, setDesiredEmotion] = useState<(typeof DESIRED_EMOTIONS)[number]>(DESIRED_EMOTIONS[0])
  const [callToActionType, setCallToActionType] = useState<(typeof CTA_TYPES)[number]>(CTA_TYPES[0])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          businessTicketId,
          targetAudience: { manifestDesire, hiddenFear, culturalContradiction },
          coreThesis,
          angle,
          psychologicalApproach,
          primaryChannel,
          desiredEmotion,
          callToActionType,
        })
      }}
      className="space-y-2"
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Algoritmo de Conflito Triplo</p>
      <input
        value={manifestDesire}
        onChange={(e) => setManifestDesire(e.target.value)}
        placeholder="Desejo manifesto do público"
        required
        maxLength={500}
        className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
      />
      <input
        value={hiddenFear}
        onChange={(e) => setHiddenFear(e.target.value)}
        placeholder="Medo oculto"
        required
        maxLength={500}
        className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
      />
      <input
        value={culturalContradiction}
        onChange={(e) => setCulturalContradiction(e.target.value)}
        placeholder="Contradição cultural"
        required
        maxLength={500}
        className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
      />
      <textarea
        value={coreThesis}
        onChange={(e) => setCoreThesis(e.target.value)}
        placeholder="Tese central de comunicação"
        rows={2}
        required
        maxLength={1000}
        className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <EnumSelect label="Ângulo" value={angle} options={STRATEGY_ANGLES} onChange={setAngle} />
        <EnumSelect
          label="Abordagem psicológica"
          value={psychologicalApproach}
          options={PSYCHOLOGICAL_APPROACHES}
          onChange={setPsychologicalApproach}
        />
        <EnumSelect label="Canal" value={primaryChannel} options={PRIMARY_CHANNELS} onChange={setPrimaryChannel} />
        <EnumSelect label="Emoção-alvo" value={desiredEmotion} options={DESIRED_EMOTIONS} onChange={setDesiredEmotion} />
        <EnumSelect label="Tipo de CTA" value={callToActionType} options={CTA_TYPES} onChange={setCallToActionType} />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Definir estratégia (Strategy Engine)
      </button>
    </form>
  )
}

function EnumSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (v: T) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-lg border border-input bg-background/60 px-2 py-1.5 text-xs"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}
