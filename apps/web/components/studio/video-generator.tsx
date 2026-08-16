"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Clapperboard,
  Download,
  Film,
  Gauge,
  ImageIcon,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Send,
  Upload,
  Volume2,
  Wand2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ASPECTS, type AspectId, aspectDims, downloadBlob, extForMime } from "@/lib/video/media-engine"
import {
  type Scene,
  THEMES,
  contentToScenes,
  renderScenesToVideo,
  themeById,
} from "@/lib/video/scene-renderer"
import { generateScenesFromTopic, generateSceneBackgrounds } from "@/lib/ai/free-ai"
import { generateAdViaApi, type AdTextProvider } from "@/lib/ai/generate-ad-client"
import { adPayloadToScenes } from "@/lib/ai/prompt-layer"
import { publishReel, type PublishReelResult } from "@/lib/instagram/publish-client"
import { useQuota } from "@/lib/usage/use-quota"
import { QuotaBadge } from "./quota-badge"
import { UpgradeModal } from "./upgrade-modal"
import { QuotaExceededError } from "@/lib/billing/quota-error"
import { hasValidConsent, onConsentChange } from "@/lib/consent/consent-store"
import { saveMeasurement } from "@/lib/measurement/measurement-store"
import type { FidelityReport } from "@/lib/measurement/fidelity"

const SAMPLE = `Pai Rico, Pai Pobre: o que a escola não te ensina sobre dinheiro.

Os ricos não trabalham por dinheiro. Eles fazem o dinheiro trabalhar por eles.

Compre ativos, não passivos. Ativo põe dinheiro no seu bolso; passivo tira.

Pague-se primeiro. Antes das contas, direcione parte da renda para investir.

Educação financeira é o verdadeiro patrimônio. Aprenda a ler números e a controlar o medo.

Comece pequeno, mas comece hoje. O tempo é o maior aliado dos juros compostos.`

type MusicMode = "off" | "calmo" | "energetico" | "corporativo"
const MEI_TONES = ["Persuasivo", "Divertido", "Profissional", "Urgente"] as const

/** Resolução das imagens de IA (menor que o canvas, para gerar mais rápido). */
function bgDims(aspect: AspectId) {
  const d = aspectDims(aspect)
  const maxW = 768
  const scale = Math.min(1, maxW / d.w)
  return { w: Math.round(d.w * scale), h: Math.round(d.h * scale) }
}

/** Rótulo amigável do provedor que gerou o anúncio MEI (badge no notice). */
function providerLabel(provider: AdTextProvider): string {
  switch (provider) {
    case "gemini-flash":
      return "Gemini Flash"
    case "deepseek":
      return "DeepSeek"
    case "pollinations-free":
      return "IA de texto grátis"
    case "local":
      return "reserva local — IA indisponível no momento"
  }
}

export function VideoGenerator() {
  const [topic, setTopic] = useState("")
  const [content, setContent] = useState("")
  const [scenes, setScenes] = useState<Scene[]>([])
  const [themeId, setThemeId] = useState(THEMES[0].id)
  const [aspect, setAspect] = useState<AspectId>("9:16")
  const [secondsPerScene, setSecondsPerScene] = useState(4)
  const [music, setMusic] = useState<MusicMode>("corporativo")
  const [narrate, setNarrate] = useState(true)

  // ---- Anúncio MEI (prompt-layer.ts): businessType + offer -> hook/body/cta ----
  const [meiBusinessType, setMeiBusinessType] = useState("")
  const [meiOffer, setMeiOffer] = useState("")
  const [meiTone, setMeiTone] = useState<string>(MEI_TONES[0])
  const [meiLoading, setMeiLoading] = useState(false)
  const meiAbortRef = useRef<AbortController | null>(null)
  const meiQuota = useQuota()
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [purchaseProduct, setPurchaseProduct] = useState<"PRO" | "AVULSO" | "PACOTE5">("PRO")

  // Vem do CTA "Comprar 1 vídeo" / "Comprar pacote" da landing (?buy=avulso
  // | ?buy=pacote5, ver app/page.tsx seção de Preço) — abre o modal de
  // compra direto no produto certo assim que o Studio carrega.
  useEffect(() => {
    const buy = new URLSearchParams(window.location.search).get("buy")
    if (buy === "avulso") {
      setPurchaseProduct("AVULSO")
      setUpgradeModalOpen(true)
    } else if (buy === "pacote5") {
      setPurchaseProduct("PACOTE5")
      setUpgradeModalOpen(true)
    }
  }, [])

  const [aiLoading, setAiLoading] = useState(false)
  const [imagesLoading, setImagesLoading] = useState(false)
  const [imageProgress, setImageProgress] = useState<{ done: number; total: number } | null>(null)
  const [rendering, setRendering] = useState(false)
  const [progress, setProgress] = useState(0)
  const [narrationProgress, setNarrationProgress] = useState<{ done: number; total: number } | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)

  // ---- Publicação no Instagram (Reels) — lib/instagram/publish-client.ts ----
  const [igCaption, setIgCaption] = useState("")
  const [igPublishing, setIgPublishing] = useState(false)
  const [igResult, setIgResult] = useState<PublishReelResult | null>(null)
  const igAbortRef = useRef<AbortController | null>(null)
  const [resultMime, setResultMime] = useState("video/webm")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Referência (M8/M9): imagem-alvo contra a qual a peça é corrigida e medida.
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null)
  const referenceImgRef = useRef<HTMLImageElement | null>(null)
  const [measurement, setMeasurement] = useState<FidelityReport | null>(null)

  // Gate de consentimento: a peça declara uso de rosto/voz de pessoa real?
  const [useRealFace, setUseRealFace] = useState(false)
  const [useRealVoice, setUseRealVoice] = useState(false)
  const [consent, setConsent] = useState<{ face: boolean; voice: boolean }>({ face: false, voice: false })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false })
  const aiAbortRef = useRef<AbortController | null>(null)
  const imagesAbortRef = useRef<AbortController | null>(null)
  const objectUrlsRef = useRef<string[]>([])
  const narrationTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Verifica consentimentos válidos e reage a mudanças (revogação/expiração).
  const refreshConsent = useCallback(async () => {
    const [face, voice] = await Promise.all([hasValidConsent("face"), hasValidConsent("voice")])
    setConsent({ face, voice })
  }, [])

  useEffect(() => {
    refreshConsent()
    return onConsentChange(refreshConsent)
  }, [refreshConsent])

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
  }, [resultUrl])

  useEffect(() => {
    return () => {
      if (referenceUrl) URL.revokeObjectURL(referenceUrl)
    }
  }, [referenceUrl])

  useEffect(() => {
    return () => {
      stopNarration()
      aiAbortRef.current?.abort()
      imagesAbortRef.current?.abort()
      meiAbortRef.current?.abort()
      igAbortRef.current?.abort()
    }
  }, [])

  const totalDuration = scenes.length * secondsPerScene

  // ---- IA: roteiro ----
  const generateWithAI = async () => {
    if (!topic.trim() || aiLoading) return
    setError(null)
    setNotice(null)
    setAiLoading(true)
    aiAbortRef.current = new AbortController()
    try {
      const { scenes: aiScenes, usedAI } = await generateScenesFromTopic(
        topic.trim(),
        5,
        aiAbortRef.current.signal,
      )
      setScenes(aiScenes)
      setNotice(
        usedAI
          ? `Roteiro com ${aiScenes.length} cenas gerado por IA. Ajuste os textos se quiser.`
          : `A IA de texto estava indisponível, então criei um rascunho base com ${aiScenes.length} cenas. Edite os textos e gere as imagens.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gerar o roteiro por IA.")
    } finally {
      setAiLoading(false)
    }
  }

  // ---- Anúncio MEI: subcamada de prompt otimizado (lib/ai/prompt-layer.ts) ----
  // Converte tipo de negócio + oferta em 3 cenas (gancho/oferta/chamada) numa
  // única chamada de IA estruturada em JSON, em vez de várias chamadas soltas.
  const generateMeiAd = async () => {
    if (!meiBusinessType.trim() || !meiOffer.trim() || meiLoading) return
    setError(null)
    setNotice(null)
    setMeiLoading(true)
    meiAbortRef.current = new AbortController()
    try {
      const { payload, provider } = await generateAdViaApi(
        { businessType: meiBusinessType.trim(), offer: meiOffer.trim(), tone: meiTone },
        meiAbortRef.current.signal,
      )
      const meiScenes = adPayloadToScenes(payload, `mei-${Date.now()}`)
      setScenes(meiScenes)
      setNotice(`Anúncio MEI gerado (${providerLabel(provider)}). Ajuste os textos se quiser.`)
      meiQuota.refresh() // reflete o consumo de cota que acabou de acontecer no servidor
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        setPurchaseProduct("PRO")
        setUpgradeModalOpen(true)
      } else {
        setError(e instanceof Error ? e.message : "Não foi possível gerar o anúncio MEI.")
      }
      meiQuota.refresh()
    } finally {
      setMeiLoading(false)
    }
  }

  // ---- Cenas a partir de texto colado ----
  const generateScenes = () => {
    setError(null)
    setNotice(null)
    const parsed = contentToScenes(content)
    if (parsed.length === 0) {
      setError("Escreva ou cole algum conteúdo para gerar as cenas.")
      return
    }
    setScenes(parsed)
  }

  // ---- IA: imagens de fundo ----
  const revokeAll = () => {
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url)
    objectUrlsRef.current = []
  }

  const generateImages = async () => {
    if (scenes.length === 0 || imagesLoading) return
    setError(null)
    setNotice(null)
    setImagesLoading(true)
    setImageProgress({ done: 0, total: scenes.length })
    imagesAbortRef.current?.abort()
    imagesAbortRef.current = new AbortController()
    revokeAll()

    const { w, h } = bgDims(aspect)
    try {
      const map = await generateSceneBackgrounds(
        scenes.map((s) => ({ id: s.id, imagePrompt: s.imagePrompt, title: s.title })),
        w,
        h,
        (done, total) => setImageProgress({ done, total }),
        imagesAbortRef.current.signal,
      )
      objectUrlsRef.current = [...map.values()]
      setScenes((prev) => prev.map((s) => ({ ...s, backgroundUrl: map.get(s.id) })))
      const ok = map.size
      if (ok === 0) {
        setError(
          "O serviço gratuito de imagens recusou as requisições agora (limite de uso). Tente novamente em alguns instantes — o vídeo renderiza normalmente sem imagens.",
        )
      } else if (ok < scenes.length) {
        setNotice(`${ok} de ${scenes.length} imagens geradas. As demais usarão o fundo com gradiente.`)
      } else {
        setNotice("Imagens de IA geradas e aplicadas a todas as cenas.")
      }
    } catch {
      setError("Não foi possível gerar as imagens agora.")
    } finally {
      setImagesLoading(false)
      setImageProgress(null)
    }
  }

  const clearImages = () => {
    revokeAll()
    setScenes((prev) => prev.map((s) => ({ ...s, backgroundUrl: undefined })))
  }

  // ---- Referência de fidelidade (M8/M9) ----
  const onReferenceFile = (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("A referência precisa ser uma imagem (PNG/JPG).")
      return
    }
    if (referenceUrl) URL.revokeObjectURL(referenceUrl)
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      referenceImgRef.current = img
      setReferenceUrl(url)
      setMeasurement(null)
      setError(null)
      setNotice("Referência carregada. Ao renderizar, a peça será corrigida e medida contra ela.")
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setError("Não foi possível carregar a imagem de referência.")
    }
    img.src = url
  }

  const clearReference = () => {
    if (referenceUrl) URL.revokeObjectURL(referenceUrl)
    referenceImgRef.current = null
    setReferenceUrl(null)
    setMeasurement(null)
  }

  const updateScene = (id: string, patch: Partial<Scene>) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const removeScene = (id: string) => {
    setScenes((prev) => prev.filter((s) => s.id !== id))
  }

  // ---- Narração (Web Speech API) ----
  const stopNarration = () => {
    narrationTimers.current.forEach((t) => clearTimeout(t))
    narrationTimers.current = []
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
  }

  const startNarration = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    stopNarration()
    const synth = window.speechSynthesis
    const ptVoice =
      synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt")) ?? undefined
    scenes.forEach((scene, i) => {
      const text = [scene.title, scene.body].filter(Boolean).join(". ")
      if (!text) return
      const timer = setTimeout(() => {
        const u = new SpeechSynthesisUtterance(text)
        u.lang = "pt-BR"
        if (ptVoice) u.voice = ptVoice
        u.rate = 1
        u.pitch = 1
        synth.speak(u)
      }, i * secondsPerScene * 1000)
      narrationTimers.current.push(timer)
    })
  }

  const testNarration = () => {
    if (scenes.length === 0) return
    startNarration()
  }

  // Bloqueio de consentimento: quais declarações estão sem termo válido.
  const consentBlock: string | null = (() => {
    const missing: string[] = []
    if (useRealFace && !consent.face) missing.push("rosto/imagem")
    if (useRealVoice && !consent.voice) missing.push("voz")
    if (missing.length === 0) return null
    return `Esta peça declara uso de ${missing.join(" e ")} de pessoa real, mas não há consentimento válido registrado. Registre o termo na aba Consentimentos para liberar a renderização.`
  })()

  // ---- Render ----
  const render = async () => {
    if (scenes.length === 0 || rendering) return
    // Gate real: sem consentimento válido, a renderização não acontece.
    if (consentBlock) {
      setError(consentBlock)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return

    setError(null)
    setNotice(null)
    setRendering(true)
    setProgress(0)
    setNarrationProgress(null)
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl)
      setResultUrl(null)
    }

    const dims = aspectDims(aspect)
    canvas.width = dims.w
    canvas.height = dims.h
    cancelRef.current = { cancelled: false }

    try {
      const { blob, mimeType, measurement: report, narrationSegments } = await renderScenesToVideo(canvas, {
        scenes,
        theme: themeById(themeId),
        brandName: "LUCROM Studio",
        secondsPerScene,
        fps: 30,
        music: music === "off" ? false : music,
        reference: referenceImgRef.current,
        narrate,
        onProgress: setProgress,
        onNarrationProgress: (done, total) => setNarrationProgress({ done, total }),
        signal: cancelRef.current,
      })
      if (cancelRef.current.cancelled) return
      const url = URL.createObjectURL(blob)
      setResultUrl(url)
      setResultMime(mimeType || "video/webm")
      setMeasurement(report)

      // publica a medição real para os Audit Gates do Estúdio consumirem.
      if (report?.hasReference) {
        saveMeasurement({ report, label: topic.trim() || scenes[0]?.title || "Peça de vídeo" })
      }

      const parts: string[] = []
      if (report?.hasReference) parts.push(`Fidelidade medida: ${report.score}% vs. referência.`)
      if (narrate) {
        parts.push(
          narrationSegments > 0
            ? `Locução sintetizada e embutida no arquivo (${narrationSegments} trecho(s)).`
            : "A locução por IA ficou indisponível agora; o arquivo saiu sem narração embutida.",
        )
      }
      if (parts.length) setNotice(parts.join(" "))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao renderizar o vídeo.")
    } finally {
      setRendering(false)
      setProgress(0)
      setNarrationProgress(null)
    }
  }

  const cancelRender = () => {
    cancelRef.current.cancelled = true
    stopNarration()
  }

  const download = () => {
    if (!resultUrl) return
    fetch(resultUrl)
      .then((r) => r.blob())
      .then((blob) => downloadBlob(blob, `lucrom-video.${extForMime(resultMime)}`))
  }

  const publishToInstagram = async () => {
    if (!resultUrl || igPublishing) return
    setIgPublishing(true)
    setIgResult(null)
    igAbortRef.current = new AbortController()
    try {
      const videoBlob = await fetch(resultUrl).then((r) => r.blob())
      const result = await publishReel({
        videoBlob,
        caption: igCaption.trim() || undefined,
        signal: igAbortRef.current.signal,
      })
      setIgResult(result)
    } catch (e) {
      setIgResult({
        ok: false,
        stage: "uploading",
        error: e instanceof Error ? e.message : "Falha inesperada ao publicar no Instagram.",
      })
    } finally {
      setIgPublishing(false)
    }
  }

  const dims = aspectDims(aspect)
  const hasImages = scenes.some((s) => s.backgroundUrl)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Coluna de conteúdo/config */}
      <div className="flex flex-col gap-4 lg:col-span-7">
        {/* Roteiro por IA */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wand2 className="h-4 w-4" aria-hidden />
            </div>
            <h2 className="font-display text-sm font-bold">Roteiro por IA</h2>
            <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              grátis · sem chave
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Tema do vídeo. Ex.: 5 erros de quem começa a investir"
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) generateWithAI()
              }}
            />
            <button
              type="button"
              onClick={generateWithAI}
              disabled={!topic.trim() || aiLoading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              {aiLoading ? "Gerando..." : "Gerar roteiro"}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            A IA escreve as cenas a partir do tema. Você pode editar tudo abaixo antes de renderizar.
          </p>
        </section>

        {/* Anúncio MEI — subcamada de prompt otimizado (prompt-layer.ts) */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" aria-hidden />
            </div>
            <h2 className="font-display text-sm font-bold">Anúncio MEI</h2>
            <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              grátis · sem chave
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={meiBusinessType}
              onChange={(e) => setMeiBusinessType(e.target.value)}
              placeholder="Tipo de negócio. Ex.: Hamburgueria"
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40"
            />
            <input
              value={meiOffer}
              onChange={(e) => setMeiOffer(e.target.value)}
              placeholder="Oferta. Ex.: Combo R$25"
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40"
            />
            <select
              value={meiTone}
              onChange={(e) => setMeiTone(e.target.value)}
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/40"
            >
              {MEI_TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <QuotaBadge
              quota={meiQuota.quota}
              loading={meiQuota.loading}
              loggedIn={meiQuota.loggedIn}
              onUpgradeClick={() => {
                setPurchaseProduct("PRO")
                setUpgradeModalOpen(true)
              }}
              onBuyOneOffClick={() => {
                setPurchaseProduct("AVULSO")
                setUpgradeModalOpen(true)
              }}
            />
          </div>
          <button
            type="button"
            onClick={generateMeiAd}
            disabled={
              !meiBusinessType.trim() ||
              !meiOffer.trim() ||
              meiLoading ||
              (meiQuota.loggedIn && meiQuota.quota !== null && !meiQuota.quota.allowed)
            }
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {meiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {meiLoading ? "Gerando..." : "Gerar anúncio (MEI)"}
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Uma única chamada de IA em JSON estruturado (gancho, oferta e chamada), otimizada pra economizar
            tokens. Preenche as 3 cenas abaixo — edite os textos e gere as imagens normalmente.
          </p>
        </section>

        {/* Conteúdo manual */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" aria-hidden />
            </div>
            <h2 className="font-display text-sm font-bold">Ou cole seu conteúdo</h2>
            <button
              type="button"
              onClick={() => setContent(SAMPLE)}
              className="ml-auto rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Usar exemplo: Pai Rico
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={7}
            placeholder="Cole aqui o roteiro, resumo de um livro, tópicos de um produto... Cada parágrafo vira uma cena."
            className="w-full resize-y rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40"
          />
          <button
            type="button"
            onClick={generateScenes}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            <Wand2 className="h-4 w-4" aria-hidden />
            Gerar cenas do texto
          </button>
        </section>

        {/* Cenas editáveis */}
        {scenes.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Film className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="font-display text-sm font-bold">
                Storyboard · {scenes.length} cenas · {totalDuration}s
              </h2>
              <div className="ml-auto flex items-center gap-2">
                {hasImages && (
                  <button
                    type="button"
                    onClick={clearImages}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Limpar imagens
                  </button>
                )}
                <button
                  type="button"
                  onClick={generateImages}
                  disabled={imagesLoading}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                >
                  {imagesLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : (
                    <ImageIcon className="h-3 w-3" aria-hidden />
                  )}
                  Fundos por IA
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {scenes.map((scene, i) => (
                <div key={scene.id} className="rounded-xl border border-border bg-secondary/50 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                      {scene.kicker}
                    </span>
                    {scene.backgroundUrl && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                        <ImageIcon className="h-2.5 w-2.5" aria-hidden />
                        fundo IA
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeScene(scene.id)}
                      className="ml-auto text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={`Remover cena ${i + 1}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                  <input
                    value={scene.title}
                    onChange={(e) => updateScene(scene.id, { title: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-semibold text-foreground outline-none focus:border-primary/40"
                    placeholder="Título da cena"
                  />
                  <input
                    value={scene.body}
                    onChange={(e) => updateScene(scene.id, { body: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] text-muted-foreground outline-none focus:border-primary/40"
                    placeholder="Complemento (opcional)"
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Coluna de estilo + render */}
      <div className="flex flex-col gap-4 lg:col-span-5">
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 className="mb-3 font-display text-sm font-bold">Estilo e formato</h2>

          <Label>Tema visual</Label>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors",
                  themeId === t.id ? "border-primary" : "border-border hover:border-primary/40",
                )}
                aria-pressed={themeId === t.id}
              >
                <span className="h-8 w-full rounded-md border border-border" style={{ background: t.bg }}>
                  <span className="block h-full w-full rounded-md" style={{ background: t.bgSoft }}>
                    <span
                      className="ml-1 mt-1 inline-block h-1.5 w-4 rounded-full"
                      style={{ background: t.accent }}
                    />
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground">{t.label}</span>
              </button>
            ))}
          </div>

          <Label>Formato</Label>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAspect(a.id)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-center transition-colors",
                  aspect === a.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                )}
                aria-pressed={aspect === a.id}
              >
                <span className="block font-mono text-xs font-semibold text-foreground">{a.id}</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {a.label.split(" · ")[1] ?? a.label}
                </span>
              </button>
            ))}
          </div>

          <Label>Duração por cena · {secondsPerScene}s</Label>
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            value={secondsPerScene}
            onChange={(e) => setSecondsPerScene(Number(e.target.value))}
            className="mb-3 w-full accent-primary"
          />

          <Label>Trilha sonora</Label>
          <div className="mb-4 grid grid-cols-4 gap-2">
            {(
              [
                { id: "off", label: "Sem" },
                { id: "calmo", label: "Calmo" },
                { id: "energetico", label: "Energia" },
                { id: "corporativo", label: "Corp." },
              ] as { id: MusicMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMusic(m.id)}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
                  music === m.id
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={music === m.id}
              >
                {m.label}
              </button>
            ))}
          </div>

          <Label>Locução embutida (M7)</Label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNarrate((v) => !v)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
                narrate
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={narrate}
            >
              <Volume2 className="h-3.5 w-3.5" aria-hidden />
              {narrate ? "Narração ligada" : "Narração desligada"}
            </button>
            <button
              type="button"
              onClick={testNarration}
              disabled={scenes.length === 0}
              className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              Testar voz (prévia)
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Ao renderizar, a locução é sintetizada por IA, decodificada via Web Audio e{" "}
            <span className="text-foreground/80">mixada dentro do arquivo exportado</span>. O botão
            &quot;Testar voz&quot; usa a voz do navegador apenas para prévia rápida.
          </p>
        </section>

        {/* Referência de fidelidade (M8/M9) */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Gauge className="h-4 w-4" aria-hidden />
            </div>
            <h2 className="font-display text-sm font-bold">Referência de fidelidade</h2>
            <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              medição real
            </span>
          </div>

          {referenceUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={referenceUrl || "/placeholder.svg"}
                alt="Imagem de referência de cor e luz"
                className="h-16 w-16 rounded-lg border border-border object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-foreground">Referência carregada</p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  A peça será corrigida (color grade) e medida contra ela ao renderizar.
                </p>
              </div>
              <button
                type="button"
                onClick={clearReference}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Remover
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-6 text-center transition-colors hover:border-primary/40">
              <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
              <span className="text-[12px] font-medium text-foreground">Enviar imagem de referência</span>
              <span className="text-[11px] text-muted-foreground">
                Cor, brilho, contraste e ruído são lidos dos pixels — sem simulação
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => onReferenceFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}

          {measurement?.hasReference && (
            <div className="mt-3 rounded-xl border border-success/30 bg-success/5 p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
                <span className="text-[12px] font-semibold text-foreground">
                  Fidelidade medida: {measurement.score}%
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
                <span>brilho {(measurement.target.brightness * 100).toFixed(0)}%</span>
                <span>ref {(measurement.reference!.brightness * 100).toFixed(0)}%</span>
                <span>contraste {(measurement.target.contrast * 100).toFixed(0)}%</span>
                <span>ref {(measurement.reference!.contrast * 100).toFixed(0)}%</span>
                <span>saturação {(measurement.target.saturation * 100).toFixed(0)}%</span>
                <span>ref {(measurement.reference!.saturation * 100).toFixed(0)}%</span>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Medição publicada para o portão de Qualidade Audiovisual (aba Estúdio).
              </p>
            </div>
          )}
        </section>

        {/* Uso de pessoa real — gate de consentimento (M6/M7) */}
        <section
          className={cn(
            "rounded-2xl border p-4 sm:p-5",
            consentBlock ? "border-destructive/40 bg-destructive/5" : "border-border bg-card",
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg",
                consentBlock ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
              )}
            >
              {consentBlock ? (
                <ShieldAlert className="h-4 w-4" aria-hidden />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden />
              )}
            </div>
            <h2 className="font-display text-sm font-bold">Uso de pessoa real</h2>
          </div>

          <div className="flex flex-col gap-2">
            <ConsentToggle
              label="Usa rosto / imagem de pessoa real"
              active={useRealFace}
              hasConsent={consent.face}
              onToggle={() => setUseRealFace((v) => !v)}
            />
            <ConsentToggle
              label="Usa voz de pessoa real"
              active={useRealVoice}
              hasConsent={consent.voice}
              onToggle={() => setUseRealVoice((v) => !v)}
            />
          </div>

          <p
            className={cn(
              "mt-3 text-[11px] leading-relaxed",
              consentBlock ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {consentBlock ??
              "Declare o uso de rosto/voz de pessoa real. A renderização só é liberada com consentimento válido registrado na aba Consentimentos."}
          </p>
        </section>

        {/* Palco de render / resultado */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Clapperboard className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="font-display text-sm font-bold">Renderização</h2>
            {totalDuration > 0 && (
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                {dims.w}×{dims.h} · {totalDuration}s
              </span>
            )}
          </div>

          {/* canvas oculto usado para gravar */}
          <canvas ref={canvasRef} className="hidden" />

          <div
            className="relative mx-auto overflow-hidden rounded-xl border border-border bg-secondary"
            style={{ aspectRatio: `${dims.w} / ${dims.h}`, maxWidth: aspect === "16:9" ? "100%" : 260 }}
          >
            {resultUrl ? (
              <video src={resultUrl} controls playsInline className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                {rendering ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
                    <span className="font-mono text-xs text-muted-foreground">
                      renderizando · {Math.round(progress * 100)}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      gravação em tempo real (~{totalDuration}s)
                    </span>
                  </>
                ) : (
                  <>
                    <Film className="h-6 w-6 text-muted-foreground" aria-hidden />
                    <span className="text-xs text-muted-foreground text-pretty">
                      {scenes.length === 0
                        ? "Gere as cenas para habilitar a renderização"
                        : "Pronto para renderizar seu vídeo"}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {rendering && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-150"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}

          {narrationProgress && (
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              sintetizando locução · {narrationProgress.done}/{narrationProgress.total}
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          {notice && !error && (
            <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">{notice}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {rendering ? (
              <button
                type="button"
                onClick={cancelRender}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
                Cancelar
              </button>
            ) : (
              <button
                type="button"
                onClick={render}
                disabled={scenes.length === 0 || !!consentBlock}
                title={consentBlock ?? undefined}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {consentBlock ? (
                  <ShieldAlert className="h-4 w-4" aria-hidden />
                ) : (
                  <Clapperboard className="h-4 w-4" aria-hidden />
                )}
                {consentBlock ? "Bloqueado: sem consentimento" : resultUrl ? "Renderizar de novo" : "Renderizar vídeo"}
              </button>
            )}
            {resultUrl && !rendering && (
              <button
                type="button"
                onClick={download}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                <Download className="h-4 w-4" aria-hidden />
                Baixar vídeo
              </button>
            )}
          </div>

          {/* Publicação no Instagram (Reels) — lib/instagram/publish-client.ts */}
          {resultUrl && !rendering && (
            <div className="mt-3 rounded-xl border border-dashed border-border/80 bg-secondary/30 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Send className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Publicar no Instagram (Reels)
                </span>
              </div>
              <textarea
                value={igCaption}
                onChange={(e) => setIgCaption(e.target.value)}
                placeholder="Legenda do Reels (opcional)"
                rows={2}
                disabled={igPublishing}
                className="w-full resize-none rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                onClick={publishToInstagram}
                disabled={igPublishing}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {igPublishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
                {igPublishing ? "Publicando..." : "Publicar no Instagram"}
              </button>

              {igResult && (
                <p
                  className={cn(
                    "mt-2 text-[11px] leading-snug",
                    igResult.ok ? "text-success" : "text-destructive",
                  )}
                >
                  {igResult.ok
                    ? `Publicado com sucesso! ID da mídia: ${igResult.mediaId}`
                    : igResult.stage === "processing_timeout"
                      ? "O vídeo ainda está sendo processado pela Meta. Tente publicar de novo em instantes."
                      : `Falha na etapa "${igResult.stage}": ${igResult.error}`}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
      <UpgradeModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        onUpgraded={() => meiQuota.refresh()}
        quota={meiQuota.quota}
        product={purchaseProduct}
      />
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  )
}

function ConsentToggle({
  label,
  active,
  hasConsent,
  onToggle,
}: {
  label: string
  active: boolean
  hasConsent: boolean
  onToggle: () => void
}) {
  const blocked = active && !hasConsent
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        className={cn(
          "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] font-medium transition-colors",
          active
            ? "border-primary bg-primary/5 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
            active ? "border-primary bg-primary text-primary-foreground" : "border-border",
          )}
        >
          {active && <span className="h-2 w-2 rounded-sm bg-current" />}
        </span>
        {label}
      </button>
      {active && (
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold",
            hasConsent ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
          )}
        >
          {hasConsent ? "consentido" : "sem termo"}
        </span>
      )}
    </div>
  )
}
