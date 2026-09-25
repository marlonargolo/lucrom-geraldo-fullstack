"use client"

import { useEffect, useMemo, useState } from "react"
import { Edit3, Image as ImageIcon, Layers3, Plus, Trash2, Video } from "lucide-react"
import { cn } from "@/lib/utils"
import { GraphicsLab } from "@/components/studio/graphics-lab"
import { PieceEditor, type PieceKind } from "@/components/studio/piece-editor"
import {
  deleteGalleryPiece,
  listGalleryPieces,
  saveGalleryPiece,
  type GalleryPiece,
} from "@/lib/graphics/piece-library"

type GalleryFilter = "all" | PieceKind

const FILTERS: Array<{ id: GalleryFilter; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "static_art", label: "Arte única" },
  { id: "carousel", label: "Carrossel" },
  { id: "reel", label: "Reels" },
]

function kindLabel(kind: PieceKind) {
  if (kind === "carousel") return "Carrossel"
  if (kind === "reel") return "Reels"
  return "Arte única"
}

function kindIcon(kind: PieceKind) {
  if (kind === "carousel") return Layers3
  if (kind === "reel") return Video
  return ImageIcon
}

function ratioClass(ratio: GalleryPiece["ratio"]) {
  if (ratio === "1:1") return "aspect-square"
  if (ratio === "4:5") return "aspect-[4/5]"
  return "aspect-[9/16]"
}

export default function PecasPage() {
  const [view, setView] = useState<"gallery" | "create">("gallery")
  const [filter, setFilter] = useState<GalleryFilter>("all")
  const [pieces, setPieces] = useState<GalleryPiece[]>([])
  const [editing, setEditing] = useState<GalleryPiece | null>(null)

  useEffect(() => {
    setPieces(listGalleryPieces())
  }, [])

  const filteredPieces = useMemo(
    () => (filter === "all" ? pieces : pieces.filter((piece) => piece.kind === filter)),
    [filter, pieces],
  )

  if (editing) {
    return (
      <PieceEditor
        draft={editing}
        onBack={() => {
          setEditing(null)
          setPieces(listGalleryPieces())
        }}
        onSave={(draft) => {
          const updated = saveGalleryPiece({ ...draft, id: editing.id })
          setEditing(updated)
          setPieces(listGalleryPieces())
        }}
      />
    )
  }

  if (view === "create") {
    return (
      <div className="flex min-h-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setView("gallery")
              setPieces(listGalleryPieces())
            }}
            className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Voltar para a galeria
          </button>
          <span className="text-[11px] text-muted-foreground">Nova peça</span>
        </div>
        <GraphicsLab />
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Biblioteca criativa</p>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Galeria de peças</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Reabra seus materiais, edite manualmente e mantenha tudo em um só lugar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setView("create")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Criar nova peça
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
              filter === id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">{filteredPieces.length} material(is)</span>
      </div>

      {filteredPieces.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ImageIcon className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Sua galeria está vazia</h2>
          <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
            Gere uma arte única, um carrossel ou um reels. O material ficará salvo aqui para você editar depois.
          </p>
          <button
            type="button"
            onClick={() => setView("create")}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Criar primeiro material
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPieces.map((piece) => {
            const Icon = kindIcon(piece.kind)
            const slide = piece.slides[0]
            return (
              <article key={piece.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div
                  className={cn("relative overflow-hidden", ratioClass(piece.ratio))}
                  style={{ backgroundColor: piece.backgroundColor }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,.22),transparent_40%),linear-gradient(145deg,transparent_25%,rgba(0,0,0,.5))]" />
                  {slide?.imageUrl && (
                    <img src={slide.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-screen" />
                  )}
                  <div className="absolute inset-x-4 bottom-4 text-white">
                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">{kindLabel(piece.kind)}</p>
                    <p className="line-clamp-2 text-lg font-bold leading-tight">{piece.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3">
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] text-muted-foreground">
                      {piece.ratio} · {new Date(piece.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(piece)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground transition hover:brightness-110"
                  >
                    <Edit3 className="h-3 w-3" aria-hidden />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deleteGalleryPiece(piece.id)
                      setPieces(listGalleryPieces())
                    }}
                    className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Excluir ${piece.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Os rascunhos gerados sem backend ficam salvos neste navegador. Materiais do backend aparecem quando a API estiver conectada.
      </p>
    </div>
  )
}