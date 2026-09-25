"use client"

// Aba "Peças" — fecha o fluxo do Módulo Ajuste Rápido Humano de ponta a
// ponta: gerar (IA, GraphicComposerService.compose) → QuickAdjustPanel
// (determinístico, sem IA). Mesmo padrão de real-pipeline-panel.tsx: chama
// o backend de verdade, brand kit vem de brandClient (real, do tenant).
//
// Tela de criação redesenhada (referência: fluxo de prompt único) — um único
// campo de texto substitui o formulário Título/Corpo/CTA como caminho
// padrão; a IA (graphic-prompt-generator) converte o prompt nesses campos
// antes de chamar o mesmo compose() de sempre. O controle manual antigo
// continua 100% disponível em "Opções Avançadas" (preenchendo o título
// manual ali, pula a geração por IA e usa o texto exatamente como digitado).

import { useEffect, useState } from "react"
import { ChevronDown, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { isApiConfigured } from "@/lib/api/client"
import { brandClient, type BrandKit } from "@/lib/production/brand-client"
import { graphicComposerClient, type GraphicComposition } from "@/lib/production/graphic-composer-client"
import { generateSlidesFromPrompt } from "@/lib/ai/graphic-prompt-generator"
import { QuickAdjustPanel } from "./quick-adjust-panel"
import { PieceEditor, type LocalPieceDraft, type PieceKind, type PieceRatio, type PieceSlide } from "./piece-editor"
import { saveGalleryPiece } from "@/lib/graphics/piece-library"
import { ReferenceUploader, type ReferenceAsset } from "./reference-uploader"

type AspectRatio = PieceRatio

const RATIO_TO_FORMAT: Record<AspectRatio, "1080x1080" | "1080x1350" | "1080x1920"> = {
  "1:1": "1080x1080",
  "4:5": "1080x1350",
  "9:16": "1080x1920",
}

interface Props {
  /** Vem da escolha de card em PecasPage (Reel=9:16, Feed=1:1, Stories=9:16...) — só pré-seleciona, o usuário pode trocar. */
  initialRatio?: AspectRatio
}

export function GraphicsLab({ initialRatio = "9:16" }: Props) {
  const [brands, setBrands] = useState<BrandKit[] | null>(null)
  const [selectedBrand, setSelectedBrand] = useState("")
  const [kind, setKind] = useState<PieceKind>("static_art")
  const [ratio, setRatio] = useState<AspectRatio>(initialRatio)
  const [prompt, setPrompt] = useState("")
  const [referenceAssets, setReferenceAssets] = useState<ReferenceAsset[]>([])
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Campos manuais ("Criar com meu design") — preservam o formulário original.
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [footer, setFooter] = useState("")
  const [slideCount, setSlideCount] = useState(5)

  const [composing, setComposing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [composition, setComposition] = useState<GraphicComposition | null>(null)
  const [localDraft, setLocalDraft] = useState<LocalPieceDraft | null>(null)

  useEffect(() => {
    brandClient
      .list()
      .then((list) => {
        setBrands(list)
        if (list[0]) setSelectedBrand(list[0].id)
      })
      .catch(() => setBrands([]))
  }, [])

  const brand = brands?.find((b) => b.id === selectedBrand) ?? null
  const referencesUploading = referenceAssets.some((reference) => reference.status === "uploading")

  const create = async () => {
    const useRealComposer = isApiConfigured() && kind !== "reel"
    if (useRealComposer && !brand) {
      setError("Selecione (ou crie) uma marca antes de gerar a peça.")
      return
    }
    const manualMode = title.trim().length > 0
    if (!manualMode && !prompt.trim()) {
      setError("Descreva o que você quer criar, ou preencha o título em Opções Avançadas.")
      return
    }
    if (referencesUploading) {
      setError("Aguarde o envio das referências terminar antes de gerar.")
      return
    }
    setError(null)
    setComposing(true)
    try {
      const selectedReferences = referenceAssets.filter(
        (reference) => reference.status === "ready" && reference.useAsReference,
      )
      const referenceNames = selectedReferences.map((reference) => `${reference.name} (${reference.kind})`)
      const promptWithReferences = referenceNames.length > 0
        ? `${prompt}\n\nConsidere estes arquivos como matrizes de referência: ${referenceNames.join(", ")}.`
        : prompt
       const selectedMedia = selectedReferences.find(
         (reference) => reference.kind === "image" || reference.kind === "video",
       )
      const selectedVisual = selectedReferences.find(
        (reference) => reference.kind === "image" || reference.kind === "video",
      )
      let slides: { title?: string; body?: string; footer?: string }[]
      if (manualMode) {
        slides = kind === "carousel"
          ? Array.from({ length: Math.max(2, Math.min(slideCount, 8)) }, (_, index) => ({
              title: index === 0 ? title : `${title} · slide ${index + 1}`,
              body,
              footer,
            }))
          : [{ title, body, footer }]
      } else {
        setStatusMessage("Gerando o conteúdo a partir do seu prompt...")
        const generated = await generateSlidesFromPrompt(
          promptWithReferences,
          kind === "carousel" ? "carousel" : "static_art",
          slideCount,
        )
        slides = generated.slides
      }

      if (useRealComposer && brand) {
        setStatusMessage("Compondo a peça...")
        const result = await graphicComposerClient.compose({
          kind: kind === "carousel" ? "carousel" : "static_art",
          format: RATIO_TO_FORMAT[ratio],
          slides,
          brand_kit: {
            palette: brand.palette,
            font_family: brand.font_family ?? undefined,
            logo_url: brand.logo_url ?? undefined,
          },
        })

        let finalComposition = result
        if (selectedVisual?.remoteUrl) {
          setStatusMessage("Aplicando sua referência visual...")
          try {
            finalComposition = await graphicComposerClient.updateLayers(
              result.id,
              [{ slide_index: 0, layer_id: "background", style: { assetUrl: selectedVisual.remoteUrl } }],
              "Referência visual do usuário aplicada ao fundo",
            )
          } catch (referenceError) {
            // Não derruba a peça já gerada por causa da referência — só avisa.
            setError(
              referenceError instanceof Error
                ? `Peça criada, mas a referência não pôde ser aplicada: ${referenceError.message}`
                : "Peça criada, mas a referência não pôde ser aplicada.",
            )
          }
        }
        setComposition(finalComposition)
        setLocalDraft(null)
      } else {
        // Prévia local: deixa o fluxo testável mesmo sem sessão, tenant ou API.
        setStatusMessage("Preparando um rascunho editável...")
        await new Promise((resolve) => setTimeout(resolve, 450))
        const localSlides: PieceSlide[] = slides.map((slide) => ({
          title: slide.title ?? "",
          body: slide.body ?? "",
          caption: slide.footer ?? "",
           imageUrl: selectedMedia?.previewUrl,
           mediaType: selectedMedia?.kind === "video" ? "video" : selectedMedia ? "image" : undefined,
        }))
        setLocalDraft(saveGalleryPiece({
          kind,
          ratio,
          slides: localSlides.length > 0 ? localSlides : [{ title: "", body: "", caption: "" }],
          backgroundColor: kind === "reel" ? "#17112F" : "#7C3AED",
        }))
        setComposition(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao compor a peça.")
    } finally {
      setComposing(false)
      setStatusMessage(null)
    }
  }

  if (composition || localDraft) {
    if (composition) {
      return (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setComposition(null)}
            className="self-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Gerar outra peça
          </button>
          <QuickAdjustPanel compositionId={composition.id} />
        </div>
      )
    }
    return (
      <PieceEditor
        draft={localDraft!}
        onBack={() => setLocalDraft(null)}
        onSave={(updatedDraft) => setLocalDraft(saveGalleryPiece(updatedDraft))}
      />
    )
  }

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="rounded-2xl border border-dashed border-border bg-card p-4 sm:p-5">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Criar uma arte sobre..."
          rows={3}
          className="w-full resize-none bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
        />

        <div className="mt-4">
          <ReferenceUploader onAssetsChange={setReferenceAssets} disabled={composing} compact />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border">
            {(["1:1", "4:5", "9:16"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRatio(r)}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  ratio === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="flex overflow-hidden rounded-lg border border-border">
            {(["static_art", "carousel", "reel"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k)
                  if (k === "reel") setRatio("9:16")
                }}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-semibold transition-colors sm:px-3.5",
                  kind === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {k === "static_art" ? "Arte única" : k === "carousel" ? "Carrossel" : "Reels"}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="mt-4 flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Opções avançadas
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-180")} aria-hidden />
        </button>

        {advancedOpen && (
          <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
            <div>
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Marca</span>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
              >
                {(brands ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {brands && brands.length === 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Nenhuma marca cadastrada. O modo de teste local continua disponível para você gerar e editar a peça.
                </p>
              )}
            </div>

            {kind === "carousel" && (
              <div>
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Número de slides
                </span>
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value) || 5)}
                  className="w-24 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                />
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Preencha o título abaixo para escrever a peça você mesmo. Depois da geração, você poderá editar fundo,
              imagem, texto e legenda manualmente.
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título (manual)"
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Texto de apoio (manual)"
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
            />
            <input
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="Chamada (CTA) (manual)"
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
            />
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      {!isApiConfigured() && (
        <p className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Modo de teste local ativo: a peça será criada na prévia e ficará disponível para edição mesmo sem backend configurado.
        </p>
      )}

      <button
        type="button"
        disabled={composing || referencesUploading}
        onClick={create}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {composing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
        {composing ? statusMessage ?? "Gerando..." : referencesUploading ? "Enviando referências..." : "Gerar peça"}
      </button>
    </section>
  )
}
