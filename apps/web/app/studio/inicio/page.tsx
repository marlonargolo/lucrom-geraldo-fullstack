"use client"

import Link from "next/link"
import { useState } from "react"
import { Plus, Film, Image, AlignLeft, Play, Tv, Star, ArrowRight, Clock, Pencil } from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { cn } from "@/lib/utils"

const FORMATS = [
  { label: "Reel",      ratio: "9:16",         Icon: Film,      href: "/studio/pecas" },
  { label: "Post",      ratio: "1:1",           Icon: Image,     href: "/studio/pecas" },
  { label: "Carrossel", ratio: "1:1",           Icon: AlignLeft, href: "/studio/pecas" },
  { label: "Vídeo",     ratio: "16:9",          Icon: Play,      href: "/studio/video" },
  { label: "Banner",    ratio: "16:9",          Icon: Tv,        href: "/studio/pecas" },
  { label: "Campanha",  ratio: "Personalizado", Icon: Star,      href: "/studio/estudio" },
]

const RECENT = [
  { id: "1", name: "Reel — Lançamento Inverno", status: "Em produção", ago: "há 10 min", count: 2 },
  { id: "2", name: "Reel — Lançamento Inverno", status: "Em produção", ago: "há 2 h",    count: 3 },
]

const DRAFTS = [
  { id: "1", name: "Institucional - Aurora Bank", ago: "há 2 dias", extra: 1 },
  { id: "2", name: "Promo - Combo R$25",           ago: "há 3 dias", extra: 0 },
]

export default function InicioPage() {
  const { session } = useAuth()
  const name = session?.email?.split("@")[0] ?? "usuário"
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"
  const [activeTab, setActiveTab] = useState<"producao" | "concluido">("producao")

  return (
    <div className="flex flex-col gap-5 overflow-auto">
      {/* Desktop: 2-col grid; Mobile: 1-col */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-5">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 md:p-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <p className="mb-1 text-sm text-muted-foreground">{greeting}, {name} 👋</p>
            <h1 className="mb-2 text-lg font-bold tracking-tight text-foreground md:text-xl lg:text-2xl">
              Seu estúdio criativo,{" "}
              <span className="text-primary">em uma única plataforma</span>.
            </h1>
            <p className="mb-4 text-sm text-muted-foreground">
              Da ideia à peça pronta, com direção e controle de qualidade.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/studio/estudio"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 active:scale-95">
                <Plus className="h-4 w-4" /> Criar nova peça
              </Link>
              <Link href="/studio/pipeline"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent active:scale-95">
                Como funciona
              </Link>
            </div>
          </div>

          {/* Projetos recentes */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Projetos recentes</h2>
              <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5">
                {(["producao", "concluido"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setActiveTab(t)}
                    className={cn("rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                      activeTab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {t === "producao" ? "Em produção" : "Concluído"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {RECENT.map((p) => (
                <Link key={p.id} href="/studio/estudio"
                  className="group rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                  <span className="mb-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {p.status}
                  </span>
                  <p className="mb-1 text-[13px] font-medium text-foreground">{p.name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Atualizado {p.ago}</span>
                    {p.count > 0 && <span className="ml-auto font-semibold text-primary">+{p.count}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Rascunho */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Rascunho</h2>
              <Link href="/studio/estudio"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition hover:brightness-110 active:scale-95">
                Continuar <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {DRAFTS.map((d, i) => (
                <Link key={d.id} href="/studio/estudio"
                  className={cn("flex items-center justify-between px-4 py-3 transition hover:bg-accent",
                    i < DRAFTS.length - 1 && "border-b border-border")}>
                  <div>
                    <p className="text-[13px] font-medium text-foreground">{d.name}</p>
                    <p className="text-[11px] text-muted-foreground">Atualizado {d.ago}</p>
                  </div>
                  {d.extra > 0 && <span className="text-[12px] font-semibold text-primary">+{d.extra}</span>}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna lateral — oculta no mobile, visível no lg */}
        <div className="hidden flex-col gap-5 lg:flex">
          {/* Seletor de formato */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-1 text-[13px] font-semibold text-foreground">O que você quer criar hoje?</p>
            <p className="mb-3 text-[11px] text-muted-foreground">Escolha o formato ideal.</p>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map(({ label, ratio, Icon, href }) => (
                <Link key={label} href={href}
                  className="group flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-3 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:scale-95">
                  <Icon className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
                  <p className="text-[11px] font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{ratio}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Edição rápida */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-[13px] font-semibold text-foreground">Edição rápida</p>
            <div className="grid grid-cols-4 gap-1.5">
              {["Imagem", "Texto", "Cores", "Elementos"].map((t) => (
                <button key={t} type="button"
                  className="flex flex-col items-center gap-1 rounded-lg border border-border bg-background p-2 text-[10px] text-muted-foreground transition hover:border-primary/30 hover:text-foreground active:scale-95">
                  <Pencil className="h-3.5 w-3.5" />{t}
                </button>
              ))}
            </div>
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border bg-background">
              <p className="text-[11px] text-muted-foreground">Selecione uma peça</p>
            </div>
            <div className="space-y-2">
              {[{ label: "Brilho", val: 10 }, { label: "Contraste", val: 8 }, { label: "Saturação", val: 4 }].map(({ label, val }) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>{label}</span><span>{val}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(val / 20) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Formato rápido — só mobile, embaixo do conteúdo */}
      <div className="lg:hidden">
        <p className="mb-3 text-sm font-semibold text-foreground">Criar nova peça</p>
        <div className="grid grid-cols-3 gap-2">
          {FORMATS.map(({ label, ratio, Icon, href }) => (
            <Link key={label} href={href}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-center transition hover:border-primary/40 active:scale-95">
              <Icon className="h-5 w-5 text-primary" />
              <p className="text-[11px] font-semibold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground">{ratio}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
