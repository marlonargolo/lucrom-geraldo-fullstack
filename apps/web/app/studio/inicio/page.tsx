"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, Clock, Edit3, FolderOpen, Image, Layers3, Plus, Video } from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { cn } from "@/lib/utils"
import { listGalleryPieces, type GalleryPiece } from "@/lib/graphics/piece-library"

const QUICK_ACTIONS = [
  { label: "Arte única", description: "Uma peça para feed ou anúncio", Icon: Image, href: "/studio/pecas" },
  { label: "Carrossel", description: "Conteúdo em vários slides", Icon: Layers3, href: "/studio/pecas" },
  { label: "Reels", description: "Vídeo vertical para redes", Icon: Video, href: "/studio/video" },
]

export default function InicioPage() {
  const { session } = useAuth()
  const [pieces, setPieces] = useState<GalleryPiece[]>([])
  const name = session?.email?.split("@")[0] ?? "usuário"
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"

  useEffect(() => {
    setPieces(listGalleryPieces())
  }, [])

  return (
    <div className="flex min-h-full flex-col gap-5">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/12 via-primary/5 to-transparent p-5 md:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <p className="mb-1 text-sm text-muted-foreground">{greeting}, {name}</p>
        <h1 className="max-w-2xl text-xl font-bold tracking-tight text-foreground md:text-2xl">
          O que vamos criar hoje?
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Escolha um ponto de partida, acompanhe suas peças recentes e retome seus rascunhos.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link
            href="/studio/estudio"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Abrir Estúdio
          </Link>
          <Link
            href="/studio/pecas"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-xs font-medium text-foreground transition hover:bg-accent"
          >
            <FolderOpen className="h-4 w-4" aria-hidden />
            Ver galeria
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Começar uma nova peça</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">A criação fica disponível para edição na Galeria.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {QUICK_ACTIONS.map(({ label, description, Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground">{label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Peças recentes</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Seus últimos materiais gerados.</p>
            </div>
            <Link href="/studio/pecas" className="text-[11px] font-semibold text-primary hover:underline">
              Abrir galeria
            </Link>
          </div>
          {pieces.length === 0 ? (
            <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center">
              <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                Ainda não há peças salvas. Comece por uma das opções acima.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {pieces.slice(0, 4).map((piece) => (
                <div key={piece.id} className="flex items-center gap-3 bg-background/40 px-3 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {piece.kind === "reel" ? <Video className="h-4 w-4" /> : piece.kind === "carousel" ? <Layers3 className="h-4 w-4" /> : <Image className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-foreground">{piece.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden />
                      {piece.ratio} · {new Date(piece.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Link href="/studio/pecas" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold text-foreground hover:border-primary/30">
                    <Edit3 className="h-3 w-3" aria-hidden />
                    Editar
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-foreground">Visão rápida</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Metric value={pieces.length} label="Peças" />
            <Metric value={pieces.filter((piece) => piece.kind === "carousel").length} label="Carrosséis" />
            <Metric value={pieces.filter((piece) => piece.kind === "reel").length} label="Reels" />
          </div>
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-[11px] font-semibold text-primary">Fluxo recomendado</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Crie no Estúdio, ajuste o material e encontre todas as versões na Galeria de Peças.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-background p-3 text-center")}>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}