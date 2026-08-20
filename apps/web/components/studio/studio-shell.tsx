"use client"

import { useEffect, useRef, useState } from "react"
import {
  Activity,
  Bell,
  Brush,
  Clapperboard,
  Command,
  FileStack,
  Home,
  LayoutTemplate,
  Network,
  Palette,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Type as TypeIcon,
  Video,
  Wand2,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { BRAND_KITS, FORMATS } from "@/lib/studio-data"
import { useProduction } from "@/lib/use-production"
import { BrandMark } from "./brand-mark"
import { BriefingComposer } from "./briefing-composer"
import { PipelineTrack } from "./pipeline-track"
import { ProductionPreview } from "./production-preview"
import { LayersPanel } from "./layers-panel"
import { AuditPanel } from "./audit-panel"
import { ArchitectureBlueprint } from "./architecture-blueprint"
import { VideoLab } from "./video-lab"
import { ConsentManager } from "./consent-manager"
import { LoginGate } from "./login-gate"
import { RealPipelinePanel } from "./real-pipeline-panel"
import { GraphicsLab } from "./graphics-lab"

/**
 * ------------------------------------------------------------------
 * DESIGN TOKENS — Lucrom Studio
 * ------------------------------------------------------------------
 * Palette (violet-on-charcoal, distinct from generic "purple SaaS"
 * by pairing it with a warm ember accent used only for production
 * status, never for UI chrome):
 *   --lc-bg        #0B0B12  page canvas
 *   --lc-surface   #14141F  cards / sidebar
 *   --lc-raised    #1B1B29  hovered / nested surfaces
 *   --lc-border    #262636  hairline
 *   --lc-border-2  #34344A  emphasized hairline
 *   --lc-violet    #7C5CFF  primary accent
 *   --lc-violet-2  #B892FF  accent, lighter step
 *   --lc-ember     #FF9A5A  production / "live" status only
 *   --lc-text      #F4F3FA  primary text
 *   --lc-text-2    #9997AE  secondary text
 *   --lc-text-3    #67667C  tertiary / placeholder
 *
 * Type: display = Space Grotesk (headlines, the one place we allow
 * character), body = Inter, mono = JetBrains Mono (status, %s,
 * timestamps — anything that reads as machine output).
 *
 * Signature element: the "pipeline rail" — a horizontal, glowing
 * stage tracker that stands in for a progress bar everywhere in the
 * product (hero, cards, continue-strip). It's literal to the
 * subject: this is a studio built from a layered AI pipeline, so
 * the pipeline itself becomes the recurring visual motif instead of
 * a generic progress bar.
 * ------------------------------------------------------------------
 */

type View = "studio" | "video" | "consent" | "architecture" | "real" | "graphics"
type Nav = "home" | View

const NAV_ITEMS: { id: Nav; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Início", icon: Home },
  { id: "studio", label: "Estúdio", icon: Wand2 },
  { id: "video", label: "Vídeo", icon: Video },
  { id: "graphics", label: "Peças", icon: LayoutTemplate },
  { id: "real", label: "Pipeline", icon: Activity },
  { id: "consent", label: "Consentimento", icon: ShieldCheck },
]

const QUICK_FORMATS = [
  { id: "reel", label: "Reel", ratio: "9:16", icon: Video },
  { id: "post", label: "Post", ratio: "1:1", icon: LayoutTemplate },
  { id: "carousel", label: "Carrossel", ratio: "1:1", icon: FileStack },
  { id: "video", label: "Vídeo", ratio: "16:9", icon: Clapperboard },
  { id: "banner", label: "Banner", ratio: "16:9", icon: TypeIcon },
  { id: "campaign", label: "Campanha", ratio: "Personalizado", icon: Sparkles },
] as const

const RECENT_PROJECTS = [
  { id: "1", title: "Reel — Lançamento Inverno", status: "Em produção", updated: "Atualizado há 10 min", collaborators: 3 },
  { id: "2", title: "Produto — Hambúrguer", status: "Concluído", updated: "Atualizado há 2 h", collaborators: 4 },
  { id: "3", title: "Institucional — Aurora Bank", status: "Rascunho", updated: "Atualizado há 2 dias", collaborators: 2 },
  { id: "4", title: "Promo — Combo R$25", status: "Concluído", updated: "Atualizado há 3 dias", collaborators: 3 },
] as const

const STATUS_STYLES: Record<string, string> = {
  "Em produção": "bg-[var(--lc-ember)]/15 text-[var(--lc-ember)]",
  "Concluído": "bg-emerald-400/15 text-emerald-300",
  "Rascunho": "bg-[var(--lc-text-3)]/15 text-[var(--lc-text-2)]",
}

export function StudioShell() {
  const { state, start, reset, refineLayer, decideGate } = useProduction()
  const [brandId, setBrandId] = useState(BRAND_KITS[0].id)
  const [formatId, setFormatId] = useState<string>(FORMATS[0].id)
  const [nav, setNav] = useState<Nav>("home")
  const mainRef = useRef<HTMLElement>(null)

  const running = state.status === "running"

  const handleProduce = (brief: string) => {
    setNav("studio")
    start(brief, brandId)
  }
  const handleStop = () => reset()
  const handleBrandChange = (id: string) => {
    if (!running) setBrandId(id)
  }
  const handleFormatChange = (id: string) => {
    if (!running) setFormatId(id)
  }

  const showInternalViews = process.env.NEXT_PUBLIC_SHOW_INTERNAL_VIEWS === "true"

  // Scroll-lock do "app shell": o Studio se comporta como um app (tipo
  // FlutterFlow) — a página em volta (html/body) nunca rola, só a área de
  // conteúdo de cada tela (o <main> abaixo) rola internamente quando o
  // conteúdo é mais alto que a viewport. Sem isso, trocar de tela deixava o
  // scroll do navegador "vazar" e componentes pareciam sumir/cortar.
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevBodyOverscroll = body.style.overscrollBehavior
    html.style.overflow = "hidden"
    body.style.overflow = "hidden"
    body.style.overscrollBehavior = "none"
    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      body.style.overscrollBehavior = prevBodyOverscroll
    }
  }, [])

  // Volta pro topo da área de conteúdo a cada troca de tela — evita herdar a
  // posição de scroll da tela anterior quando a nova tem menos conteúdo.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [nav])

  return (
    <div
      className="flex h-screen min-w-0 overflow-hidden bg-[var(--lc-bg)] text-[var(--lc-text)] antialiased"
      style={
        {
          "--lc-bg": "#0B0B12",
          "--lc-surface": "#14141F",
          "--lc-raised": "#1B1B29",
          "--lc-border": "#262636",
          "--lc-border-2": "#34344A",
          "--lc-violet": "#7C5CFF",
          "--lc-violet-2": "#B892FF",
          "--lc-ember": "#FF9A5A",
          "--lc-text": "#F4F3FA",
          "--lc-text-2": "#9997AE",
          "--lc-text-3": "#67667C",
          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
        } as React.CSSProperties
      }
    >
      <Sidebar nav={nav} onNavChange={setNav} showInternalViews={showInternalViews} />

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />

        <main
          ref={mainRef}
          className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-3 lg:px-6"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={nav}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex min-h-0 flex-1 flex-col"
            >
              {nav === "architecture" ? (
                <ArchitectureBlueprint />
              ) : nav === "video" ? (
                <VideoLab />
              ) : nav === "real" ? (
                <RealPipelinePanel />
              ) : nav === "graphics" ? (
                <GraphicsLab />
              ) : nav === "consent" ? (
                <ConsentManager />
              ) : nav === "studio" ? (
                <StudioView
                  running={running}
                  state={state}
                  brandId={brandId}
                  formatId={formatId}
                  onBrandChange={handleBrandChange}
                  onFormatChange={handleFormatChange}
                  onProduce={handleProduce}
                  onStop={() => {
                    handleStop()
                    setNav("home")
                  }}
                  onRefineLayer={refineLayer}
                  onDecideGate={decideGate}
                  onBack={() => setNav("home")}
                />
              ) : (
                <HomeView
                  onStartCreate={() => setNav("studio")}
                  onQuickProduce={handleProduce}
                  showInternalViews={showInternalViews}
                  onViewChange={setNav}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

function Sidebar({
  nav,
  onNavChange,
  showInternalViews,
}: {
  nav: Nav
  onNavChange: (v: Nav) => void
  showInternalViews: boolean
}) {
  const items = showInternalViews
    ? [...NAV_ITEMS, { id: "architecture" as const, label: "Arquitetura", icon: Network }]
    : NAV_ITEMS

  return (
    <aside className="hidden h-full w-48 shrink-0 flex-col overflow-y-auto border-r border-[var(--lc-border)] bg-[var(--lc-surface)] px-2.5 py-3 lg:flex">
      <div className="flex items-center gap-2 px-1 pb-3">
        <BrandMark />
        <div className="leading-tight">
          <p className="font-[var(--font-display,'Space_Grotesk',sans-serif)] text-[12px] font-semibold tracking-tight">
            Lucrom Studio
          </p>
          <p className="text-[8px] font-medium uppercase tracking-[0.14em] text-[var(--lc-text-3)]">
            Agência de IA
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {items.map((item) => {
          const Icon = item.icon
          const active = nav === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavChange(item.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] font-medium transition-colors",
                active
                  ? "bg-[var(--lc-violet)]/12 text-[var(--lc-violet-2)]"
                  : "text-[var(--lc-text-2)] hover:bg-[var(--lc-raised)] hover:text-[var(--lc-text)]",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="mt-2 rounded-lg border border-[var(--lc-border)] bg-gradient-to-br from-[var(--lc-violet)]/15 to-transparent p-2.5">
        <div className="flex items-center gap-1.5 text-[var(--lc-violet-2)]">
          <Wand2 className="h-3 w-3" aria-hidden />
          <p className="text-[9.5px] font-semibold">Novidade no Lucrom AI</p>
        </div>
        <p className="mt-1 text-[9.5px] leading-relaxed text-[var(--lc-text-2)]">
          Imagens com IA mais realistas.
        </p>
      </div>

      <div className="mt-2 flex items-center gap-2 rounded-md border border-[var(--lc-border)] px-2 py-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--lc-violet)] text-[10px] font-semibold text-white">
          LF
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[10.5px] font-medium">Lucas Ferreira</p>
          <p className="truncate text-[8.5px] text-[var(--lc-text-3)]">Plano Profissional</p>
        </div>
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Topbar                                                               */
/* ------------------------------------------------------------------ */

function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex shrink-0 items-center gap-4 border-b border-[var(--lc-border)] bg-[var(--lc-bg)]/85 px-4 py-1.5 backdrop-blur-xl lg:px-6">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--lc-text-3)]" aria-hidden />
        <input
          type="text"
          placeholder="Buscar projetos, peças ou mídias..."
          className="w-full rounded-full border border-[var(--lc-border)] bg-[var(--lc-surface)] py-1 pl-8 pr-12 text-[11px] text-[var(--lc-text)] placeholder:text-[var(--lc-text-3)] outline-none focus:border-[var(--lc-violet)]/50"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md border border-[var(--lc-border-2)] px-1 py-0.5 text-[9px] text-[var(--lc-text-3)]">
          <Command className="h-2 w-2" aria-hidden />K
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <button
          type="button"
          aria-label="Notificações"
          className="relative flex h-7 w-7 items-center justify-center rounded-full border border-[var(--lc-border)] text-[var(--lc-text-2)] hover:bg-[var(--lc-raised)]"
        >
          <Bell className="h-3 w-3" aria-hidden />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--lc-ember)]" />
        </button>
        <LoginGate />
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Home view — hero, quick create, recent projects                     */
/* ------------------------------------------------------------------ */

function HomeView({
  onStartCreate,
  onQuickProduce,
  showInternalViews,
  onViewChange,
}: {
  onStartCreate: () => void
  onQuickProduce: (brief: string) => void
  showInternalViews: boolean
  onViewChange: (v: View) => void
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
      <div className="col-span-12 flex min-h-0 flex-col gap-3 xl:col-span-9">
        <Hero onStartCreate={onStartCreate} />
        <QuickCreateRow showInternalViews={showInternalViews} onViewChange={onViewChange} onStartCreate={onStartCreate} />

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 items-end justify-between">
            <h2 className="font-[var(--font-display,'Space_Grotesk',sans-serif)] text-[13px] font-semibold tracking-tight">
              Projetos recentes
            </h2>
            <button type="button" className="text-[10.5px] font-medium text-[var(--lc-violet-2)] hover:underline">
              Ver todos →
            </button>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2.5 lg:grid-cols-4">
            {RECENT_PROJECTS.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>

        <ContinueProductionStrip onResume={onStartCreate} />
      </div>

      <div className="col-span-12 hidden min-h-0 xl:col-span-3 xl:block">
        <QuickEditPanel />
      </div>
    </div>
  )
}

function QuickCreateRow({
  showInternalViews,
  onViewChange,
  onStartCreate,
}: {
  showInternalViews: boolean
  onViewChange: (v: View) => void
  onStartCreate: () => void
}) {
  return (
    <section className="shrink-0 rounded-xl border border-[var(--lc-border)] bg-[var(--lc-surface)] p-3">
      <div className="mb-2 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-[var(--font-display,'Space_Grotesk',sans-serif)] text-[13px] font-semibold tracking-tight">
            O que você quer criar hoje?
          </h2>
          <p className="text-[10.5px] text-[var(--lc-text-2)]">Escolha o formato ideal para o seu objetivo.</p>
        </div>
        {showInternalViews && (
          <button
            type="button"
            onClick={() => onViewChange("architecture")}
            className="hidden items-center gap-1 text-[10px] text-[var(--lc-text-3)] hover:text-[var(--lc-text-2)] sm:flex"
          >
            <Network className="h-3 w-3" aria-hidden />
            Arquitetura interna
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {QUICK_FORMATS.map((format, i) => {
          const Icon = format.icon
          return (
            <button
              key={format.id}
              type="button"
              onClick={onStartCreate}
              className={cn(
                "group flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center transition-colors",
                i === 0
                  ? "border-[var(--lc-violet)] bg-[var(--lc-violet)]/10"
                  : "border-[var(--lc-border)] bg-[var(--lc-raised)]/40 hover:border-[var(--lc-border-2)]",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md",
                  i === 0 ? "bg-[var(--lc-violet)] text-white" : "bg-[var(--lc-surface)] text-[var(--lc-text-2)]",
                )}
              >
                <Icon className="h-3 w-3" aria-hidden />
              </span>
              <span className="text-[10px] font-medium">{format.label}</span>
              <span className="font-[var(--font-mono,'JetBrains_Mono',monospace)] text-[8.5px] text-[var(--lc-text-3)]">
                {format.ratio}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Hero({ onStartCreate }: { onStartCreate: () => void }) {
  return (
    <section className="relative shrink-0 overflow-hidden rounded-xl border border-[var(--lc-border)] bg-gradient-to-br from-[#1B1330] via-[#14101F] to-[#0B0B12] px-5 py-3.5 sm:px-6">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[var(--lc-violet)]/25 blur-[80px]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-md">
          <p className="text-[10.5px] text-[var(--lc-text-2)]">Boa noite, Lucas 👋</p>
          <h1 className="mt-1 font-[var(--font-display,'Space_Grotesk',sans-serif)] text-[19px] font-semibold leading-[1.15] tracking-tight sm:text-[21px]">
            Seu estúdio criativo, em{" "}
            <span className="bg-gradient-to-r from-[var(--lc-violet-2)] to-[var(--lc-violet)] bg-clip-text text-transparent">
              uma única plataforma
            </span>
            .
          </h1>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--lc-text-2)]">
            Da ideia à peça pronta, com direção e controle de qualidade.
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onStartCreate}
              className="flex items-center gap-1.5 rounded-full bg-[var(--lc-violet)] px-3.5 py-1.5 text-[11px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="h-3 w-3" aria-hidden />
              Criar nova peça
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-[var(--lc-border-2)] px-3.5 py-1.5 text-[11px] font-medium text-[var(--lc-text-2)] hover:text-[var(--lc-text)]"
            >
              Como funciona
            </button>
          </div>
        </div>

        <PipelineRailPreview />
      </div>
    </section>
  )
}

/** Signature element: a glowing horizontal stage rail standing in for the
 *  product's core mechanic (briefing → criação → direção → auditoria). */
function PipelineRailPreview() {
  const stages = ["Briefing", "Criação", "Direção", "Auditoria"]
  return (
    <div className="relative z-10 flex shrink-0 items-center gap-0 rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface)]/70 p-2 backdrop-blur lg:w-64">
      {stages.map((stage, i) => (
        <div key={stage} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-0.5">
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full font-[var(--font-mono,'JetBrains_Mono',monospace)] text-[8px] font-medium",
                i === 0
                  ? "bg-[var(--lc-violet)] text-white shadow-[0_0_0_3px_rgba(124,92,255,0.18)]"
                  : "border border-[var(--lc-border-2)] text-[var(--lc-text-3)]",
              )}
            >
              {i + 1}
            </span>
            <span className="text-[8px] text-[var(--lc-text-2)]">{stage}</span>
          </div>
          {i < stages.length - 1 && (
            <div className="mx-1 mb-3 h-px flex-1 bg-gradient-to-r from-[var(--lc-violet)]/60 to-[var(--lc-border-2)]" />
          )}
        </div>
      ))}
    </div>
  )
}

function ProjectCard({ project }: { project: (typeof RECENT_PROJECTS)[number] }) {
  return (
    <article className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface)] transition-colors hover:border-[var(--lc-border-2)]">
      <div className="relative flex h-10 shrink-0 items-end bg-gradient-to-br from-[var(--lc-raised)] to-[var(--lc-surface)] px-2 pb-1.5">
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[8px] font-semibold",
            STATUS_STYLES[project.status],
          )}
        >
          {project.status}
        </span>
      </div>
      <div className="min-h-0 flex-1 px-2 pb-2 pt-1">
        <h3 className="truncate text-[11px] font-medium">{project.title}</h3>
        <p className="mt-0.5 truncate text-[9px] text-[var(--lc-text-3)]">{project.updated}</p>
      </div>
    </article>
  )
}

function ContinueProductionStrip({ onResume }: { onResume: () => void }) {
  return (
    <section className="flex shrink-0 flex-col items-start justify-between gap-2 rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--lc-raised)]">
          <Clapperboard className="h-3 w-3 text-[var(--lc-text-2)]" aria-hidden />
        </span>
        <div>
          <p className="text-[10.5px] font-medium">Continue sua produção</p>
          <p className="text-[9.5px] text-[var(--lc-text-2)]">Reel — Lançamento Inverno</p>
        </div>
      </div>

      <div className="flex w-full items-center gap-2 sm:w-auto">
        <div className="flex items-center gap-1.5">
          <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--lc-raised)]">
            <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[var(--lc-violet)] to-[var(--lc-violet-2)]" />
          </div>
          <span className="font-[var(--font-mono,'JetBrains_Mono',monospace)] text-[9px] text-[var(--lc-text-2)]">
            72%
          </span>
        </div>
        <button
          type="button"
          onClick={onResume}
          className="flex items-center gap-1 whitespace-nowrap rounded-full bg-[var(--lc-violet)] px-3 py-1 text-[10px] font-semibold text-white"
        >
          Continuar →
        </button>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Quick edit rail — right column, mirrors the reference layout        */
/* ------------------------------------------------------------------ */

function QuickEditPanel() {
  const [tab, setTab] = useState<"imagem" | "texto" | "cores" | "elementos">("imagem")
  const tabs = [
    { id: "imagem" as const, label: "Imagem", icon: Sparkles },
    { id: "texto" as const, label: "Texto", icon: TypeIcon },
    { id: "cores" as const, label: "Cores", icon: Palette },
    { id: "elementos" as const, label: "Elementos", icon: LayoutTemplate },
  ]
  const sliders = [
    { label: "Brilho", value: 10 },
    { label: "Contraste", value: 8 },
    { label: "Saturação", value: 4 },
  ]

  return (
    <div className="flex h-full flex-col rounded-xl border border-[var(--lc-border)] bg-[var(--lc-surface)] p-3">
      <h2 className="shrink-0 font-[var(--font-display,'Space_Grotesk',sans-serif)] text-[12.5px] font-semibold tracking-tight">
        Edição rápida
      </h2>

      <div className="mt-2.5 grid shrink-0 grid-cols-4 gap-1 rounded-lg border border-[var(--lc-border)] bg-[var(--lc-raised)]/40 p-1">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md py-1.5 text-[9px] font-medium transition-colors",
                active ? "bg-[var(--lc-violet)]/15 text-[var(--lc-violet-2)]" : "text-[var(--lc-text-3)] hover:text-[var(--lc-text-2)]",
              )}
            >
              <Icon className="h-3 w-3" aria-hidden />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="mt-2.5 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-[var(--lc-border)] bg-gradient-to-br from-[var(--lc-raised)] to-[var(--lc-surface)]">
        <Brush className="h-6 w-6 text-[var(--lc-text-3)]" aria-hidden />
      </div>

      <div className="mt-2.5 grid shrink-0 grid-cols-2 gap-2">
        <button type="button" className="rounded-lg border border-[var(--lc-border)] py-1.5 text-[10px] font-medium text-[var(--lc-text-2)] hover:bg-[var(--lc-raised)]">
          Substituir
        </button>
        <button type="button" className="rounded-lg border border-[var(--lc-border)] py-1.5 text-[10px] font-medium text-[var(--lc-text-2)] hover:bg-[var(--lc-raised)]">
          Remover
        </button>
      </div>

      <div className="mt-3 shrink-0">
        <p className="mb-1.5 text-[10.5px] font-semibold">Ajustes</p>
        <div className="flex flex-col gap-2">
          {sliders.map((s) => (
            <div key={s.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[9.5px] text-[var(--lc-text-2)]">{s.label}</span>
                <span className="font-[var(--font-mono,'JetBrains_Mono',monospace)] text-[9px] text-[var(--lc-text-3)]">
                  {s.value}
                </span>
              </div>
              <div className="h-1 rounded-full bg-[var(--lc-raised)]">
                <div
                  className="h-full rounded-full bg-[var(--lc-violet)]"
                  style={{ width: `${(s.value / 20) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Studio (create) view — briefing, pipeline, preview, layers, audit   */
/* Layout fixo (sem scroll de página): esquerda e direita viram abas,   */
/* cada uma com scroll só internamente; a Peça (preview) fica sempre    */
/* visível ao centro. Padrão "tela de app" (FlutterFlow), não site.     */
/* ------------------------------------------------------------------ */

const tabTransition = { duration: 0.16, ease: [0.16, 1, 0.3, 1] as const }

function StudioView({
  running,
  state,
  brandId,
  formatId,
  onBrandChange,
  onFormatChange,
  onProduce,
  onStop,
  onRefineLayer,
  onDecideGate,
  onBack,
}: {
  running: boolean
  state: ReturnType<typeof useProduction>["state"]
  brandId: string
  formatId: string
  onBrandChange: (id: string) => void
  onFormatChange: (id: string) => void
  onProduce: (brief: string) => void
  onStop: () => void
  onRefineLayer: (key: string, note: string) => void
  onDecideGate: (gateId: string, action: "approved" | "rejected", reviewer: string) => void
  onBack: () => void
}) {
  const [leftTab, setLeftTab] = useState<"briefing" | "pipeline">("briefing")
  const [rightTab, setRightTab] = useState<"layers" | "audit">("layers")

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-[10.5px] font-medium text-[var(--lc-text-2)] hover:text-[var(--lc-text)]"
        >
          ← Voltar para o início
        </button>
        <StatusPill status={state.status} progress={state.progress} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-12">
        {/* Esquerda — Briefing / Pipeline */}
        <div className="flex min-h-0 flex-col gap-2 lg:col-span-5">
          <TabBar
            tabs={[
              { id: "briefing", label: "Briefing" },
              { id: "pipeline", label: "Linha de produção" },
            ]}
            active={leftTab}
            onChange={setLeftTab}
            groupId="studio-left"
          />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
            <AnimatePresence mode="wait">
              {leftTab === "briefing" ? (
                <motion.div key="briefing" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={tabTransition}>
                  <BriefingComposer
                    running={running}
                    brandId={brandId}
                    onBrandChange={onBrandChange}
                    formatId={formatId}
                    onFormatChange={onFormatChange}
                    onProduce={onProduce}
                    onStop={onStop}
                  />
                </motion.div>
              ) : (
                <motion.div key="pipeline" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={tabTransition}>
                  <PipelineTrack engineStatus={state.engineStatus} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Centro — Peça (preview), sempre visível */}
        <div className="min-h-0 lg:col-span-3">
          <div className="h-full overflow-y-auto overscroll-contain">
            <ProductionPreview state={state} brandId={brandId} formatId={formatId} />
          </div>
        </div>

        {/* Direita — Camadas / Auditoria */}
        <div className="flex min-h-0 flex-col gap-2 lg:col-span-4">
          <TabBar
            tabs={[
              { id: "layers", label: "Camadas" },
              { id: "audit", label: "Auditoria" },
            ]}
            active={rightTab}
            onChange={setRightTab}
            groupId="studio-right"
          />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
            <AnimatePresence mode="wait">
              {rightTab === "layers" ? (
                <motion.div key="layers" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={tabTransition}>
                  <LayersPanel
                    doneLayers={state.doneLayers}
                    layerVersions={state.layerVersions}
                    logs={state.logs}
                    onRefineLayer={onRefineLayer}
                  />
                </motion.div>
              ) : (
                <motion.div key="audit" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={tabTransition}>
                  <AuditPanel
                    gates={state.gates}
                    auditLog={state.auditLog}
                    status={state.status}
                    onDecideGate={onDecideGate}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Par de abas com destaque animado (spring) — usado nas colunas do Estúdio
 *  pra caber Briefing+Pipeline e Camadas+Auditoria sem empilhar tudo junto. */
function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  groupId,
}: {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
  groupId: string
}) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-1 rounded-lg border border-border bg-secondary/40 p-1">
      {tabs.map((t) => {
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "relative rounded-md py-1.5 text-[11px] font-medium transition-colors",
              isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive && (
              <motion.span
                layoutId={`${groupId}-tab-highlight`}
                className="absolute inset-0 rounded-md bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function StatusPill({ status, progress }: { status: string; progress: number }) {
  const label =
    status === "running"
      ? `produzindo · ${progress}%`
      : status === "review"
        ? "aguardando aprovação"
        : status === "done"
          ? "peça pronta"
          : "estúdio ocioso"

  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--lc-border)] bg-[var(--lc-raised)] px-3 py-1.5">
      <Activity
        className={cn(
          "h-3.5 w-3.5",
          status === "running"
            ? "animate-pulse text-[var(--lc-violet-2)]"
            : status === "review"
              ? "animate-pulse text-[var(--lc-ember)]"
              : status === "done"
                ? "text-emerald-400"
                : "text-[var(--lc-text-3)]",
        )}
        aria-hidden
      />
      <span className="font-[var(--font-mono,'JetBrains_Mono',monospace)] text-[11px] text-[var(--lc-text-2)]">
        {label}
      </span>
    </div>
  )
}