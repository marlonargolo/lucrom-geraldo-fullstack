"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  Captions,
  Image as ImageIcon,
  Palette,
  Save,
  Type,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type PieceKind = "static_art" | "carousel" | "reel"
export type PieceRatio = "1:1" | "4:5" | "9:16"

export interface PieceSlide {
  title: string
  body: string
  caption: string
  imageUrl?: string
  mediaType?: "image" | "video"
}

export interface LocalPieceDraft {
  kind: PieceKind
  ratio: PieceRatio
  slides: PieceSlide[]
  backgroundColor: string
  id?: string
  createdAt?: string
}

interface Props {
  draft: LocalPieceDraft
  onBack: () => void
  onSave?: (draft: LocalPieceDraft) => void
}

type EditorPanel = "background" | "image" | "text" | "caption"

const PANEL_LABELS: Array<{ id: EditorPanel; label: string; Icon: typeof Palette }> = [
  { id: "background", label: "Fundo", Icon: Palette },
  { id: "image", label: "Imagem", Icon: ImageIcon },
  { id: "text", label: "Texto", Icon: Type },
  { id: "caption", label: "Legenda", Icon: Captions },
]

const COLOR_PRESETS = ["#7C3AED", "#17112F", "#0F172A", "#0E7490", "#B45309", "#111111"]

function kindLabel(kind: PieceKind) {
  if (kind === "carousel") return "Carrossel"
  if (kind === "reel") return "Reels"
  return "Arte única"
}

function ratioClass(ratio: PieceRatio) {
  if (ratio === "1:1") return "aspect-square"
  if (ratio === "4:5") return "aspect-[4/5]"
  return "aspect-[9/16]"
}

export function PieceEditor({ draft, onBack, onSave }: Props) {
  const [piece, setPiece] = useState(draft)
  const [slideIndex, setSlideIndex] = useState(0)
  const [activePanel, setActivePanel] = useState<EditorPanel>("background")
  const [saved, setSaved] = useState(false)
  const objectUrlsRef = useRef<string[]>([])
  const currentSlide = piece.slides[slideIndex] ?? piece.slides[0]

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const updatePiece = (patch: Partial<LocalPieceDraft>) => {
    setPiece((previous) => ({ ...previous, ...patch }))
    setSaved(false)
  }

  const updateSlide = (patch: Partial<PieceSlide>) => {
    setPiece((previous) => ({
      ...previous,
      slides: previous.slides.map((slide, index) =>
        index === slideIndex ? { ...slide, ...patch } : slide,
      ),
    }))
    setSaved(false)
  }

  const handleMedia = (file: File | null) => {
    if (!file || (!file.type.startsWith("image/") && !file.type.startsWith("video/"))) return
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.push(url)
    updateSlide({ imageUrl: url, mediaType: file.type.startsWith("video/") ? "video" : "image" })
  }

  const save = () => {
    onSave?.(piece)
    setSaved(true)
  }

  if (!currentSlide) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Não foi possível abrir o material para edição.
      </div>
    )
  }

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Gerar outra peça
        </button>
        <span className="ml-auto rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
          {kindLabel(piece.kind)}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)]">
        <div className="flex flex-col gap-3">
          {piece.kind === "carousel" && piece.slides.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {piece.slides.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSlideIndex(index)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    slideIndex === index
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  Slide {index + 1}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-3">
            <div
              className={cn(
                "relative mx-auto w-full max-w-[420px] overflow-hidden rounded-xl border border-white/10",
                ratioClass(piece.ratio),
              )}
              style={{ backgroundColor: piece.backgroundColor }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,.2),transparent_42%),linear-gradient(145deg,transparent_25%,rgba(0,0,0,.42))]" />
              {currentSlide.imageUrl && currentSlide.mediaType === "video" ? (
                <video
                  src={currentSlide.imageUrl}
                  muted
                  autoPlay
                  loop
                  playsInline
                  aria-label="Vídeo da peça"
                  className="absolute inset-0 h-full w-full object-cover opacity-75 mix-blend-screen"
                />
              ) : currentSlide.imageUrl ? (
                <img
                  src={currentSlide.imageUrl}
                  alt="Imagem da peça"
                  className="absolute inset-0 h-full w-full object-cover opacity-75 mix-blend-screen"
                />
              ) : null}
              <div className="absolute left-[9%] right-[9%] top-[6%] flex items-center justify-between">
                <span className="rounded-full bg-black/25 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/80">
                  Criatai
                </span>
                <span className="rounded-full bg-black/25 px-2 py-1 font-mono text-[9px] text-white/80">
                  {piece.ratio}
                </span>
              </div>
              <div className="absolute inset-x-[9%] bottom-[10%] z-10 text-white">
                <h2 className="max-w-[90%] text-[clamp(1.35rem,4vw,2.5rem)] font-extrabold leading-[1.05]">
                  {currentSlide.title || "Título da peça"}
                </h2>
                <p className="mt-3 max-w-[90%] text-[clamp(.78rem,1.8vw,1rem)] leading-relaxed text-white/80">
                  {currentSlide.body || "Texto de apoio da sua peça."}
                </p>
                <p className="mt-5 text-[clamp(.65rem,1.4vw,.8rem)] font-bold uppercase tracking-[0.16em] text-white/90">
                  {currentSlide.caption || "Sua chamada aqui"}
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Edite o material manualmente. As alterações aparecem na prévia na hora.
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="text-sm font-bold text-foreground">Editar material</h2>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
              manual
            </span>
          </div>

          <div className="mb-4 grid grid-cols-4 gap-1.5">
            {PANEL_LABELS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActivePanel(id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10px] font-medium transition-colors",
                  activePanel === id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={activePanel === id}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>

          {activePanel === "background" && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Cor do fundo
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={piece.backgroundColor}
                    onChange={(event) => updatePiece({ backgroundColor: event.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-secondary p-1"
                    aria-label="Escolher cor do fundo"
                  />
                  <input
                    value={piece.backgroundColor}
                    onChange={(event) => updatePiece({ backgroundColor: event.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                    aria-label="Código da cor do fundo"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updatePiece({ backgroundColor: color })}
                    className="h-7 w-7 rounded-full border-2 border-white/20 transition-transform hover:scale-110"
                    style={{ backgroundColor: color }}
                    aria-label={`Usar fundo ${color}`}
                  />
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Troque a cor sem precisar gerar a peça novamente.
              </p>
            </div>
          )}

          {activePanel === "image" && (
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-4 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                 <ImageIcon className="h-4 w-4" aria-hidden />
                 Escolher imagem ou vídeo
                <input
                  type="file"
                   accept="image/*,video/*"
                  className="hidden"
                   onChange={(event) => handleMedia(event.target.files?.[0] ?? null)}
                />
              </label>
              {currentSlide.imageUrl ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary p-2">
                   {currentSlide.mediaType === "video" ? (
                     <video src={currentSlide.imageUrl} muted className="h-12 w-12 rounded-md object-cover" />
                   ) : (
                     <img src={currentSlide.imageUrl} alt="Imagem selecionada" className="h-12 w-12 rounded-md object-cover" />
                   )}
                   <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                     {currentSlide.mediaType === "video" ? "Vídeo aplicado à peça" : "Imagem aplicada à peça"}
                   </span>
                  <button
                    type="button"
                    onClick={() => updateSlide({ imageUrl: undefined })}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Remover imagem"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ) : (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Adicione uma imagem própria para substituir o visual gerado.
                </p>
              )}
            </div>
          )}

          {activePanel === "text" && (
            <div className="flex flex-col gap-3">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Título
                <textarea
                  value={currentSlide.title}
                  onChange={(event) => updateSlide({ title: event.target.value })}
                  rows={3}
                  className="mt-1.5 w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                />
              </label>
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Texto de apoio
                <textarea
                  value={currentSlide.body}
                  onChange={(event) => updateSlide({ body: event.target.value })}
                  rows={4}
                  className="mt-1.5 w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                />
              </label>
            </div>
          )}

          {activePanel === "caption" && (
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Legenda / chamada
                <textarea
                  value={currentSlide.caption}
                  onChange={(event) => updateSlide({ caption: event.target.value })}
                  rows={5}
                  placeholder="Escreva a legenda ou CTA do material"
                  className="mt-1.5 w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                />
              </label>
            </div>
          )}

          <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
            {saved && <span className="text-[11px] text-primary">Alterações salvas neste rascunho.</span>}
            <button
              type="button"
              onClick={save}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Save className="h-3.5 w-3.5" aria-hidden />
              Salvar edição
            </button>
          </div>
        </section>
      </div>
    </section>
  )
}