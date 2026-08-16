"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, MicOff, Sparkles, CornerDownLeft, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { BRAND_KITS, FORMATS, TONES, SAMPLE_BRIEFS } from "@/lib/studio-data"
import { apiFetch, isApiConfigured, DEFAULT_TENANT_ID } from "@/lib/api/client"
import { generateAdViaApi, type AdTextProvider, type GenerateAdResult } from "@/lib/ai/generate-ad-client"
import { useQuota } from "@/lib/usage/use-quota"
import { QuotaBadge } from "./quota-badge"
import { UpgradeModal } from "./upgrade-modal"
import { QuotaExceededError } from "@/lib/billing/quota-error"

interface Props {
  running: boolean
  brandId: string
  onBrandChange: (id: string) => void
  formatId: string
  onFormatChange: (id: string) => void
  onProduce: (brief: string) => void
  onStop: () => void
}

export function BriefingComposer({
  running,
  brandId,
  onBrandChange,
  formatId,
  onFormatChange,
  onProduce,
  onStop,
}: Props) {
  const [brief, setBrief] = useState("")
  const [tone, setTone] = useState<string>(TONES[0])

  // ---- Anúncio MEI rápido (lib/ai/prompt-layer.ts) — preenche o brief acima ----
  const [meiBusinessType, setMeiBusinessType] = useState("")
  const [meiOffer, setMeiOffer] = useState("")
  const [meiLoading, setMeiLoading] = useState(false)
  const [meiError, setMeiError] = useState<string | null>(null)
  const [meiPayload, setMeiPayload] = useState<GenerateAdResult["payload"] | null>(null)
  const [meiProvider, setMeiProvider] = useState<AdTextProvider | null>(null)
  const meiAbortRef = useRef<AbortController | null>(null)
  const meiQuota = useQuota()
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)

  // Status da chamada real ao serviço de renderização assíncrona (best-effort,
  // não bloqueia nem substitui a simulação local em `onProduce`).
  const [asyncRenderNote, setAsyncRenderNote] = useState<string | null>(null)

  // ---- Ditar por voz (Web Speech API) -------------------------------------
  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(true)
  const recognitionRef = useRef<any>(null)
  const baseBriefRef = useRef("")

  useEffect(() => {
    if (typeof window === "undefined") return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setVoiceSupported(false)
      return
    }
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
    return () => {
      try {
        recognition.stop()
      } catch {
        /* noop */
      }
    }
  }, [])

  useEffect(() => {
    return () => meiAbortRef.current?.abort()
  }, [])

  const toggleDictation = () => {
    const recognition = recognitionRef.current
    if (!recognition || running) return
    if (listening) {
      recognition.stop()
      setListening(false)
      return
    }
    baseBriefRef.current = brief
    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  const submit = () => {
    const value = brief.trim()
    if (!value || running) return
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
    }
    const fullBrief = `${value}\n\nTom: ${tone}`
    onProduce(fullBrief)
    triggerRealRender(fullBrief)
  }

  /**
   * Modo rápido MEI: transforma "tipo de negócio" + "oferta" num anúncio
   * estruturado (hook/body/cta/visual/narração) numa única chamada de IA
   * (lib/ai/prompt-layer.ts) e usa o resultado pra preencher o brief acima,
   * pronto pra revisar e produzir com o botão "Produzir peça".
   */
  const generateMeiBrief = async () => {
    if (!meiBusinessType.trim() || !meiOffer.trim() || meiLoading || running) return
    setMeiError(null)
    setMeiLoading(true)
    meiAbortRef.current = new AbortController()
    try {
      const { payload, provider } = await generateAdViaApi(
        { businessType: meiBusinessType.trim(), offer: meiOffer.trim(), tone },
        meiAbortRef.current.signal,
      )
      setMeiPayload(payload)
      setMeiProvider(provider)
      setBrief(`${payload.hook}\n\n${payload.body}\n\n${payload.cta}`)
      meiQuota.refresh() // reflete o consumo de cota que acabou de acontecer no servidor
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        setUpgradeModalOpen(true)
      } else {
        setMeiError(e instanceof Error ? e.message : "Não foi possível gerar o anúncio MEI.")
      }
      meiQuota.refresh()
    } finally {
      setMeiLoading(false)
    }
  }

  /**
   * Envia o payload real (incluindo o aspect ratio do formato escolhido) pro
   * serviço de renderização assíncrona (AiOrchestratorService — Fal.ai com
   * fallback automático pro Replicate). Retorna 202 Accepted imediatamente;
   * o resultado final chega via webhook + video-render.worker.ts no backend.
   * Best-effort: se a API não estiver configurada, só a simulação local roda.
   */
  const triggerRealRender = async (prompt: string) => {
    if (!isApiConfigured()) return

    const format = FORMATS.find((f) => f.id === formatId)
    const brand = BRAND_KITS.find((b) => b.id === brandId)

    try {
      const job = await apiFetch<{ id: string; status: string }>("/api/v1/engines/m8/ai-video/generate", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: DEFAULT_TENANT_ID,
          prompt,
          aspect_ratio: format?.ratio ?? "9:16",
          brand_kit: brand ? { palette: brand.palette.map((p) => p.hex) } : undefined,
        }),
      })
      setAsyncRenderNote(`Render assíncrono real disparado (202 Accepted) — job ${job.id.slice(0, 8)}…`)
    } catch (err) {
      console.warn("[briefing-composer] Falha ao disparar a geração assíncrona real:", err)
      setAsyncRenderNote(null)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="font-display text-sm font-semibold tracking-tight">Briefing</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {listening ? "ouvindo…" : voiceSupported ? "texto ou voz" : "somente texto"}
        </span>
      </div>

      <div className="relative">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
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
          title={voiceSupported ? "Ditar por voz" : "Ditado por voz não suportado neste navegador"}
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

      {/* Modo rápido MEI — subcamada de prompt otimizado (prompt-layer.ts) */}
      <div className="mt-3 rounded-xl border border-dashed border-border/80 bg-secondary/30 p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Modo rápido · Anúncio MEI
          </span>
          <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            grátis · sem chave
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={meiBusinessType}
            onChange={(e) => setMeiBusinessType(e.target.value)}
            placeholder="Tipo de negócio. Ex.: Hamburgueria"
            disabled={running}
            className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <input
            value={meiOffer}
            onChange={(e) => setMeiOffer(e.target.value)}
            placeholder="Oferta. Ex.: Combo R$25"
            disabled={running}
            className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="button"
            onClick={generateMeiBrief}
            disabled={
              !meiBusinessType.trim() ||
              !meiOffer.trim() ||
              meiLoading ||
              running ||
              (meiQuota.loggedIn && meiQuota.quota !== null && !meiQuota.quota.allowed)
            }
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {meiLoading ? "Gerando..." : "Gerar com IA"}
          </button>
        </div>
        <div className="mt-2">
          <QuotaBadge
            quota={meiQuota.quota}
            loading={meiQuota.loading}
            loggedIn={meiQuota.loggedIn}
            onUpgradeClick={() => setUpgradeModalOpen(true)}
          />
        </div>
        {meiError && <p className="mt-2 text-[11px] text-destructive">{meiError}</p>}
        {meiPayload && !meiError && (
          <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Gerado com o tom "{tone}"</span> ·{" "}
              {providerLabel(meiProvider)}
            </p>
            <p className="truncate">Prompt visual: {meiPayload.visualPrompt}</p>
          </div>
        )}
      </div>

      {/* sugestões rápidas */}
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

      {/* parâmetros */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Marca">
          <Select value={brandId} onChange={onBrandChange}>
            {BRAND_KITS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Formato">
          <Select value={formatId} onChange={onFormatChange}>
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.ratio}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tom de voz">
          <Select value={tone} onChange={setTone}>
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* ação */}
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
            disabled={!brief.trim()}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all",
              "hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Produzir peça
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
        onClose={() => setUpgradeModalOpen(false)}
        onUpgraded={() => meiQuota.refresh()}
        quota={meiQuota.quota}
      />
    </section>
  )
}

/** Rótulo amigável do provedor que gerou o anúncio, pra mostrar no preview do modo MEI. */
function providerLabel(provider: AdTextProvider | null): string {
  switch (provider) {
    case "gemini-flash":
      return "via Gemini Flash"
    case "deepseek":
      return "via DeepSeek"
    case "pollinations-free":
      return "via IA de texto grátis"
    case "local":
      return "via reserva local (IA indisponível no momento)"
    default:
      return ""
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
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
