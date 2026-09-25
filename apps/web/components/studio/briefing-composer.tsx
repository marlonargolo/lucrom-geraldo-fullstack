"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, MicOff, Sparkles, CornerDownLeft, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { FORMATS, TONES, SAMPLE_BRIEFS } from "@/lib/studio-data"
import { apiFetch, ApiError } from "@/lib/api/client"
import { friendlyApiError } from "@/lib/auth/auth-context"
import { UpgradeModal } from "./upgrade-modal"
import { brandClient, type BrandKit } from "@/lib/production/brand-client"
import { ReferenceUploader, type ReferenceAsset } from "./reference-uploader"

interface PromptOptimization {
  id: string
  provider: "deepseek" | "local"
  cacheHit?: boolean
  title: string
  objective: string
  audience: string
  coreMessage: string
  visualDirection: string
  voiceoverText: string
  shotList: string[]
  negativePrompt: string
  optimizedPrompt: string
  preservationRules: string[]
  note?: string
}

interface Props {
  running: boolean
  brandId: string
  onBrandChange: (id: string) => void
  formatId: string
  onFormatChange: (id: string) => void
  onProduce: (brief: string) => void
  onStop: () => void
  onJobCreated?: (jobId: string) => void
}

export function BriefingComposer({
  running,
  brandId,
  onBrandChange,
  formatId,
  onFormatChange,
  onProduce,
  onStop,
  onJobCreated,
}: Props) {
  const [brief, setBrief] = useState("")
  const [tone, setTone] = useState<string>(TONES[0])
  const [realBrands, setRealBrands] = useState<BrandKit[]>([])

  const [enhancing, setEnhancing] = useState(false)
  const enhanceAbortRef = useRef<AbortController | null>(null)
  const [asyncRenderNote, setAsyncRenderNote] = useState<string | null>(null)
  const [optimization, setOptimization] = useState<PromptOptimization | null>(null)
  const [optimizationError, setOptimizationError] = useState<string | null>(null)
  const [referenceAssets, setReferenceAssets] = useState<ReferenceAsset[]>([])
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)

  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(true)
  const recognitionRef = useRef<any>(null)
  const baseBriefRef = useRef("")

  // Carrega brand kits reais do backend
  useEffect(() => {
    brandClient.list()
      .then((brands) => {
        setRealBrands(brands)
        // Se tem brands reais e o brandId atual é um mock, troca pelo primeiro real
        if (brands.length > 0) {
          onBrandChange(brands[0].id)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setVoiceSupported(false); return }
    const recognition = new SR()
    recognition.lang = "pt-BR"
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event: any) => {
      let transcript = ""
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      const base = baseBriefRef.current
      const sep = base && !base.endsWith(" ") ? " " : ""
      setBrief((base + sep + transcript).trimStart())
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    return () => { try { recognition.stop() } catch { } }
  }, [])

  useEffect(() => {
    return () => enhanceAbortRef.current?.abort()
  }, [])

  useEffect(() => {
    setOptimization(null)
    setOptimizationError(null)
  }, [brandId, formatId, tone])

  const toggleDictation = () => {
    const recognition = recognitionRef.current
    if (!recognition || running) return
    if (listening) { recognition.stop(); setListening(false); return }
    baseBriefRef.current = brief
    try { recognition.start(); setListening(true) } catch { setListening(false) }
  }

  const submit = async () => {
    const value = brief.trim()
    if (!value || running || enhancing || referenceAssets.some((asset) => asset.status === "uploading")) return
    if (listening) { recognitionRef.current?.stop(); setListening(false) }
    const format = FORMATS.find((item) => item.id === formatId) ?? FORMATS[0]
    const selectedReferences = referenceAssets.filter(
      (reference) => reference.status === "ready" && reference.useAsReference,
    )
    const controller = new AbortController()
    enhanceAbortRef.current?.abort()
    enhanceAbortRef.current = controller
    setEnhancing(true)
    setOptimizationError(null)
    setAsyncRenderNote(null)
    try {
      const brand = realBrands.find((item) => item.id === brandId)
      const result = await apiFetch<PromptOptimization>("/api/v1/ai/prompt-optimize", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          prompt: value,
          formatId: format.id,
          aspectRatio: format.ratio,
          tone,
          references: selectedReferences.map((reference) => `${reference.name} (${reference.kind})`),
          brandContext: brand
            ? { name: brand.name, palette: brand.palette }
            : {},
        }),
      })
      if (controller.signal.aborted) return
      setOptimization(result)
      const realBrand = realBrands.find((item) => item.id === brandId)
      const job = await apiFetch<{ id: string; status: string }>("/api/v1/ai/generations", {
        method: "POST",
        body: JSON.stringify({
          optimizationId: result.id,
          originalPrompt: value,
          aspectRatio: format.ratio,
          tone,
          assetType: "reel",
          brandContext: realBrand
            ? { name: realBrand.name, palette: realBrand.palette }
            : {},
        }),
      })
      onProduce(result.optimizedPrompt)
      setAsyncRenderNote(
        result.cacheHit
          ? `Briefing recuperado do cache e produção iniciada — sem repetição · job ${job.id.slice(0, 8)}…`
          : result.provider === "deepseek"
            ? `Briefing corrigido pelo DeepSeek e produção iniciada · job ${job.id.slice(0, 8)}…`
            : `Briefing organizado e produção iniciada · job ${job.id.slice(0, 8)}…`,
      )
      onJobCreated?.(job.id)
    } catch (err) {
      if (!controller.signal.aborted) {
        if (err instanceof ApiError && err.status === 402) {
          setOptimizationError("Sua cota de vídeos do mês acabou. Compre um vídeo avulso ou faça upgrade para continuar.")
          setUpgradeModalOpen(true)
        } else {
          setOptimizationError(err instanceof ApiError ? friendlyApiError(err) : err instanceof Error ? err.message : "Não foi possível otimizar o briefing.")
        }
      }
    } finally {
      if (!controller.signal.aborted) setEnhancing(false)
    }
  }

  // Brands a exibir: reais do backend, ou vazio se ainda carregando
  const brandsToShow = realBrands

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="font-display text-sm font-semibold tracking-tight">Briefing</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {listening ? "ouvindo…" : voiceSupported ? "texto ou voz" : "somente texto"}
        </span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        Escreva do seu jeito. A IA corrige, organiza e envia o briefing automaticamente para produção.
      </p>

      <div className="relative">
        <textarea
          value={brief}
          onChange={(e) => {
            setBrief(e.target.value)
            setOptimization(null)
            setOptimizationError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Descreva a peça que a agência deve produzir. Ex.: Crie um Reel de 30s anunciando a nova conta digital sem tarifas, com pessoas reais e um CTA para baixar o app."
          rows={4}
          className="w-full resize-none rounded-xl border border-input bg-background/60 p-3.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={toggleDictation}
          disabled={!voiceSupported || running}
          aria-label={listening ? "Parar ditado" : "Ditar por voz"}
          aria-pressed={listening}
          className={cn(
            "absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            listening
              ? "animate-pulse border-primary/40 bg-primary/15 text-primary"
              : "border-border bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          {voiceSupported ? <Mic className="h-4 w-4" aria-hidden /> : <MicOff className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      <ReferenceUploader onAssetsChange={setReferenceAssets} disabled={running} />

      {/* Sugestões rápidas */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SAMPLE_BRIEFS.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setBrief(s)}
            className="max-w-full truncate rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {s.slice(0, 42)}…
          </button>
        ))}
      </div>

      {optimization && !running && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-[11px] font-semibold text-primary">Ajuste automático aplicado</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {optimization.title} · {optimization.provider === "deepseek" ? "direção DeepSeek" : "estruturação automática"}
          </p>
        </div>
      )}

      {optimizationError && (
        <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
          {optimizationError}
        </p>
      )}

      {/* Parâmetros */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Marca">
          <Select value={brandId} onChange={onBrandChange}>
            {brandsToShow.length > 0 ? (
              brandsToShow.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))
            ) : (
              <option value="" disabled>Carregando marcas...</option>
            )}
          </Select>
        </Field>
        <Field label="Formato">
          <Select value={formatId} onChange={onFormatChange}>
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>{f.name} · {f.ratio}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tom de voz">
          <Select value={tone} onChange={setTone}>
            {TONES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Ação */}
      <div className="mt-4 flex items-center gap-3">
        {running ? (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <Square className="h-4 w-4" aria-hidden />
            Interromper produção
          </button>
        ) : (
            <button
            type="button"
            onClick={submit}
              disabled={!brief.trim() || brandsToShow.length === 0 || enhancing || referenceAssets.some((asset) => asset.status === "uploading")}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all",
              "hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {enhancing
              ? "Corrigindo e produzindo..."
              : referenceAssets.some((asset) => asset.status === "uploading")
                ? "Enviando referências..."
                : "Produzir peça"}
          </button>
        )}
        <kbd className="hidden shrink-0 items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1.5 text-[10px] text-muted-foreground sm:inline-flex">
          <CornerDownLeft className="h-3 w-3" aria-hidden /> ⌘ Enter
        </kbd>
      </div>

      {asyncRenderNote && (
        <p className="mt-2 text-[10px] text-muted-foreground/80">{asyncRenderNote}</p>
      )}

      <UpgradeModal
        open={upgradeModalOpen}
        product="AVULSO"
        onClose={() => setUpgradeModalOpen(false)}
        onUpgraded={() => {
          setUpgradeModalOpen(false)
          setOptimizationError(null)
        }}
      />
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function Select({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
    >
      {children}
    </select>
  )
}