"use client"

import { useState, useEffect, useRef } from "react"
import {
  Home,
  Wand2,
  Video,
  LayoutTemplate,
  Activity,
  ShieldCheck,
  Search,
  Bell,
  Command,
  Plus,
  Sparkles,
  Type,
  Clapperboard,
  FileStack,
  Network,
  Palette,
  Brush,
  X,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Square,
  RefreshCw,
  Settings,
  Eye,
  Volume2,
  Image,
  Layers,
  List,
  BarChart,
  User,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  BRAND_KITS,
  FORMATS,
  MODULES,
  ENGINES,
  LAYERS,
  AUDIT_GATES,
  SAMPLE_BRIEFS,
} from "@/lib/studio-data"
import { useProduction } from "@/lib/use-production"
import { BrandMark } from "./brand-mark"
import { LoginGate } from "./login-gate"

// ============================================================
// 1. TIPOS E CONSTANTES GLOBAIS
// ============================================================
type Nav =
  | "home"
  | "studio"
  | "video"
  | "graphics"
  | "real"
  | "consent"
  | "architecture"

type ModalType =
  | "create"
  | "format"
  | "project"
  | "briefing"
  | "replace-image"
  | "continue-production"
  | null

const NAV_ITEMS: { id: Nav; label: string; icon: any }[] = [
  { id: "home", label: "Início", icon: Home },
  { id: "studio", label: "Estúdio", icon: Wand2 },
  { id: "video", label: "Vídeo", icon: Video },
  { id: "graphics", label: "Peças", icon: LayoutTemplate },
  { id: "real", label: "Pipeline", icon: Activity },
  { id: "consent", label: "Consentimento", icon: ShieldCheck },
]

// ============================================================
// 2. COMPONENTE PRINCIPAL – StudioShell
// ============================================================
export function StudioShell() {
  // Navegação
  const [nav, setNav] = useState<Nav>("home")
  const mainRef = useRef<HTMLElement>(null)

  // Estado de produção
  const { state, start, reset, refineLayer, decideGate } = useProduction()
  const running = state.status === "running"

  // Modais
  const [modal, setModal] = useState<ModalType>(null)
  const [selectedFormat, setSelectedFormat] = useState<string>(FORMATS[0].id)
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [briefText, setBriefText] = useState("")

  // Dados mockados (projetos, rascunhos)
  const projects = [
    { id: "1", title: "Reel — Lançamento Inverno", status: "Em produção", updated: "há 10 min", collaborators: 2 },
    { id: "2", title: "Reel — Lançamento Inverno", status: "Em produção", updated: "há 2 h", collaborators: 3 },
  ]
  const drafts = [
    { id: "d1", title: "Institucional - Aurora Bank", updated: "há 2 dias" },
    { id: "d2", title: "Promo - Combo R$25", updated: "há 3 dias" },
  ]

  // Scroll lock do app
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    html.style.overflow = "hidden"
    body.style.overflow = "hidden"
    body.style.overscrollBehavior = "none"
    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      body.style.overscrollBehavior = "auto"
    }
  }, [])

  useEffect(() => {
    if (modal) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [modal])

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [nav])

  // Handlers modais
  const handleOpenModal = (type: ModalType, data?: any) => {
    if (type === "project") setSelectedProject(data)
    else setSelectedProject(null)
    setModal(type)
  }
  const handleCloseModal = () => setModal(null)

  const handleStartProduction = (brief: string) => {
    start(brief, BRAND_KITS[0].id)
    setNav("studio")
  }

  const showInternalViews = process.env.NEXT_PUBLIC_SHOW_INTERNAL_VIEWS === "true"
  const items = showInternalViews
    ? [...NAV_ITEMS, { id: "architecture" as const, label: "Arquitetura", icon: Network }]
    : NAV_ITEMS

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-[#0B0B12] text-[#F4F3FA]"
      style={{ fontFamily: "var(--font-body, Inter, system-ui, sans-serif)" }}
    >
      {/* Sidebar */}
      <aside className="hidden h-full w-48 shrink-0 flex-col border-r border-[#262636] bg-[#14141F] px-2.5 py-3 lg:flex">
        <div className="flex items-center gap-2 px-1 pb-3">
          <BrandMark />
          <div className="leading-tight">
            <p className="font-display text-[12px] font-semibold tracking-tight">Lucrom Studio</p>
            <p className="text-[8px] font-medium uppercase tracking-[0.14em] text-[#67667C]">Agência de IA</p>
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
                onClick={() => setNav(item.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] font-medium transition-colors",
                  active
                    ? "bg-[#7C5CFF]/12 text-[#B892FF]"
                    : "text-[#9997AE] hover:bg-[#1B1B29] hover:text-[#F4F3FA]"
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="mt-2 rounded-lg border border-[#262636] bg-gradient-to-br from-[#7C5CFF]/15 to-transparent p-2.5">
          <div className="flex items-center gap-1.5 text-[#B892FF]">
            <Wand2 className="h-3 w-3" aria-hidden />
            <p className="text-[9.5px] font-semibold">Novidade no Lucrom AI</p>
          </div>
          <p className="mt-1 text-[9.5px] leading-relaxed text-[#9997AE]">Imagens com IA mais realistas.</p>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-md border border-[#262636] px-2 py-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7C5CFF] text-[10px] font-semibold text-white">
            LF
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[10.5px] font-medium">Lucas Ferreira</p>
            <p className="truncate text-[8.5px] text-[#67667C]">Plano Profissional</p>
          </div>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex shrink-0 items-center gap-4 border-b border-[#262636] bg-[#0B0B12]/85 px-4 py-1.5 backdrop-blur-xl lg:px-6">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#67667C]" />
            <input
              type="text"
              placeholder="Buscar projetos, peças ou mídias..."
              className="w-full rounded-full border border-[#262636] bg-[#14141F] py-1 pl-8 pr-12 text-[11px] text-[#F4F3FA] placeholder:text-[#67667C] outline-none focus:border-[#7C5CFF]/50"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md border border-[#34344A] px-1 py-0.5 text-[9px] text-[#67667C]">
              <Command className="h-2 w-2" />K
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <button className="relative flex h-7 w-7 items-center justify-center rounded-full border border-[#262636] text-[#9997AE] hover:bg-[#1B1B29]">
              <Bell className="h-3 w-3" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#FF9A5A]" />
            </button>
            <LoginGate />
          </div>
        </header>

        {/* Área de conteúdo rolável internamente */}
        <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 lg:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={nav}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto flex min-h-full max-w-[1400px] flex-col"
            >
              {nav === "architecture" && <ArchitectureView />}
              {nav === "video" && <VideoLabView />}
              {nav === "real" && <RealPipelineView />}
              {nav === "graphics" && <GraphicsLabView />}
              {nav === "consent" && <ConsentManagerView />}
              {nav === "studio" && (
                <StudioView
                  running={running}
                  state={state}
                  brandId={BRAND_KITS[0].id}
                  formatId={selectedFormat}
                  onBrandChange={() => {}}
                  onFormatChange={setSelectedFormat}
                  onProduce={(brief) => {
                    start(brief, BRAND_KITS[0].id)
                  }}
                  onStop={() => {
                    reset()
                    setNav("home")
                  }}
                  onRefineLayer={refineLayer}
                  onDecideGate={decideGate}
                  onBack={() => setNav("home")}
                />
              )}
              {nav === "home" && (
                <HomeView
                  onStartCreate={() => handleOpenModal("create")}
                  onQuickProduce={handleStartProduction}
                  onOpenModal={handleOpenModal}
                  selectedFormat={selectedFormat}
                  setSelectedFormat={setSelectedFormat}
                  projects={projects}
                  drafts={drafts}
                  state={state}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ===== MODAIS ===== */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl rounded-2xl border border-[#34344A] bg-[#14141F]/95 p-6 shadow-2xl backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handleCloseModal}
                className="absolute right-3 top-3 rounded-full p-1 text-[#67667C] hover:bg-[#1B1B29] hover:text-[#F4F3FA]"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mt-2">
                {modal === "create" && (
                  <>
                    <h2 className="font-display text-xl font-semibold">Nova peça</h2>
                    <p className="text-sm text-[#9997AE]">Escolha o formato e comece seu briefing.</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {FORMATS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setSelectedFormat(f.id)
                            handleCloseModal()
                            handleOpenModal("format")
                          }}
                          className="flex items-center gap-2 rounded-lg border border-[#262636] p-3 transition-colors hover:border-[#7C5CFF]"
                        >
                          {f.id === "reel" && <Video className="h-4 w-4 text-[#B892FF]" />}
                          {f.id === "feed" && <LayoutTemplate className="h-4 w-4 text-[#B892FF]" />}
                          {f.id === "yt" && <Clapperboard className="h-4 w-4 text-[#B892FF]" />}
                          {f.id === "story" && <FileStack className="h-4 w-4 text-[#B892FF]" />}
                          <span className="text-sm font-medium">{f.name}</span>
                          <span className="ml-auto text-xs text-[#67667C]">{f.ratio}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {modal === "format" && (
                  <>
                    <h2 className="font-display text-xl font-semibold">
                      Configurar {FORMATS.find((f) => f.id === selectedFormat)?.name || selectedFormat}
                    </h2>
                    <p className="text-sm text-[#9997AE]">Defina duração, tom e outras opções.</p>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-[#67667C]">Duração</label>
                        <select className="mt-1 w-full rounded-lg border border-[#262636] bg-[#1B1B29] px-3 py-2 text-sm text-[#F4F3FA]">
                          <option>15s</option>
                          <option>30s</option>
                          <option>45s</option>
                          <option>60s</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-[#67667C]">Tom</label>
                        <select className="mt-1 w-full rounded-lg border border-[#262636] bg-[#1B1B29] px-3 py-2 text-sm text-[#F4F3FA]">
                          <option>Nubank — direto e humano</option>
                          <option>Apple — minimal e aspiracional</option>
                          <option>Editorial — sofisticado</option>
                          <option>Energético — jovem e rápido</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleCloseModal()
                          handleOpenModal("briefing")
                        }}
                        className="mt-2 w-full rounded-full bg-[#7C5CFF] py-2 text-sm font-semibold text-white"
                      >
                        Continuar para briefing
                      </button>
                    </div>
                  </>
                )}

                {modal === "project" && selectedProject && (
                  <>
                    <h2 className="font-display text-xl font-semibold">{selectedProject.title}</h2>
                    <p className="text-sm text-[#9997AE]">Status: {selectedProject.status}</p>
                    <p className="text-sm text-[#9997AE]">Atualizado {selectedProject.updated}</p>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => {
                          handleCloseModal()
                          setNav("studio")
                        }}
                        className="flex-1 rounded-full bg-[#7C5CFF] py-2 text-sm font-semibold text-white"
                      >
                        Continuar produção
                      </button>
                      <button className="flex-1 rounded-full border border-[#262636] py-2 text-sm text-[#9997AE]">
                        Ver detalhes
                      </button>
                    </div>
                  </>
                )}

                {modal === "briefing" && (
                  <>
                    <h2 className="font-display text-xl font-semibold">Briefing</h2>
                    <p className="text-sm text-[#9997AE]">Descreva sua ideia ou escolha um exemplo.</p>
                    <div className="mt-4 space-y-3">
                      <textarea
                        className="w-full rounded-lg border border-[#262636] bg-[#1B1B29] p-3 text-sm text-[#F4F3FA] placeholder:text-[#67667C]"
                        rows={4}
                        placeholder="Ex: Crie um Reel de 30s anunciando nossa nova conta digital..."
                        value={briefText}
                        onChange={(e) => setBriefText(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        {SAMPLE_BRIEFS.map((sample, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setBriefText(sample)}
                            className="rounded-full border border-[#262636] px-3 py-1 text-[10px] text-[#9997AE] hover:bg-[#1B1B29]"
                          >
                            Exemplo {i + 1}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (briefText.trim()) {
                            handleStartProduction(briefText)
                            handleCloseModal()
                          }
                        }}
                        className="w-full rounded-full bg-[#7C5CFF] py-2 text-sm font-semibold text-white disabled:opacity-50"
                        disabled={!briefText.trim()}
                      >
                        Iniciar produção
                      </button>
                    </div>
                  </>
                )}

                {modal === "replace-image" && (
                  <>
                    <h2 className="font-display text-xl font-semibold">Substituir imagem</h2>
                    <p className="text-sm text-[#9997AE]">Faça upload de uma nova imagem ou escolha da biblioteca.</p>
                    <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-[#34344A] p-8">
                      <Image className="h-8 w-8 text-[#67667C]" />
                      <p className="text-sm text-[#9997AE]">Arraste ou clique para selecionar</p>
                      <button className="rounded-full bg-[#7C5CFF] px-4 py-1.5 text-sm font-semibold text-white">
                        Selecionar arquivo
                      </button>
                    </div>
                  </>
                )}

                {modal === "continue-production" && (
                  <>
                    <h2 className="font-display text-xl font-semibold">Continuar produção</h2>
                    <p className="text-sm text-[#9997AE]">Retome de onde parou.</p>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between rounded-lg border border-[#262636] p-3">
                        <div>
                          <p className="font-medium">Reel — Lançamento Inverno</p>
                          <p className="text-xs text-[#67667C]">72% concluído</p>
                        </div>
                        <div className="h-1 w-24 rounded-full bg-[#1B1B29]">
                          <div className="h-full w-[72%] rounded-full bg-[#7C5CFF]" />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleCloseModal()
                          setNav("studio")
                        }}
                        className="w-full rounded-full bg-[#7C5CFF] py-2 text-sm font-semibold text-white"
                      >
                        Abrir estúdio completo
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================
// 3. VIEWS DA SIDEBAR (com conteúdo real)
// ============================================================

// 3.1 HOME VIEW
function HomeView({
  onStartCreate,
  onQuickProduce,
  onOpenModal,
  selectedFormat,
  setSelectedFormat,
  projects,
  drafts,
  state,
}: any) {
  const quickFormats = [
    { id: "reel", label: "Reel", ratio: "9:16", icon: Video },
    { id: "post", label: "Post", ratio: "1:1", icon: LayoutTemplate },
    { id: "carrossel", label: "Carrossel", ratio: "1:1", icon: FileStack },
    { id: "video", label: "Video", ratio: "16:9", icon: Clapperboard },
    { id: "banner", label: "Banner", ratio: "16:9", icon: Type },
    { id: "campanha", label: "Campanha", ratio: "Personalizado", icon: Sparkles },
  ]

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row">
        {/* Hero */}
        <section className="relative flex-1 overflow-hidden rounded-xl border border-[#262636] bg-gradient-to-br from-[#1B1330] via-[#14101F] to-[#0B0B12] px-5 py-3.5 sm:px-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#7C5CFF]/25 blur-[80px]" />
          <div className="relative flex h-full flex-col justify-center gap-2">
            <p className="text-[10.5px] text-[#9997AE]">Boa noite, Lucas 👋</p>
            <h1 className="font-display text-[19px] font-semibold leading-[1.15] tracking-tight sm:text-[21px]">
              Seu estúdio criativo, em{" "}
              <span className="bg-gradient-to-r from-[#B892FF] to-[#7C5CFF] bg-clip-text text-transparent">
                uma única plataforma
              </span>
              .
            </h1>
            <p className="text-[11px] leading-relaxed text-[#9997AE]">
              Da ideia à peça pronta, com direção e controle de qualidade.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button
                onClick={onStartCreate}
                className="flex items-center gap-1.5 rounded-full bg-[#7C5CFF] px-3.5 py-1.5 text-[11px] font-semibold text-white transition-transform hover:scale-[1.02]"
              >
                <Plus className="h-3 w-3" /> Criar nova peça
              </button>
              <button className="flex items-center gap-1.5 rounded-full border border-[#34344A] px-3.5 py-1.5 text-[11px] font-medium text-[#9997AE] hover:text-[#F4F3FA]">
                Como funciona
              </button>
            </div>
          </div>
        </section>

        {/* Quick Create */}
        <section className="flex w-full flex-col justify-center rounded-xl border border-[#262636] bg-[#14141F] p-3 lg:w-64">
          <h2 className="font-display text-[13px] font-semibold tracking-tight">O que você quer criar hoje?</h2>
          <p className="text-[10.5px] text-[#9997AE]">Escolha o formato ideal.</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-3">
            {quickFormats.map((format) => {
              const Icon = format.icon
              return (
                <button
                  key={format.id}
                  onClick={() => {
                    setSelectedFormat(format.id)
                    onOpenModal("format")
                  }}
                  className="group flex flex-col items-center gap-1 rounded-lg border border-[#262636] bg-[#1B1B29]/40 px-1.5 py-2 text-center transition-colors hover:border-[#34344A]"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#14141F] text-[#9997AE]">
                    <Icon className="h-3 w-3" />
                  </span>
                  <span className="text-[10px] font-medium">{format.label}</span>
                  <span className="font-mono text-[8.5px] text-[#67667C]">{format.ratio}</span>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      {/* Linha 2: Projetos + Rascunho + Edição rápida */}
      <div className="flex flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex flex-1 flex-col gap-3 lg:w-2/3">
          <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[#262636] bg-[#14141F] p-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold tracking-tight">Projetos recentes</h2>
              <div className="flex gap-1">
                <button className="rounded-full bg-[#7C5CFF]/10 px-2 py-0.5 text-[9px] font-medium text-[#B892FF]">
                  Em produção
                </button>
                <button className="rounded-full px-2 py-0.5 text-[9px] font-medium text-[#67667C] hover:bg-[#1B1B29]">
                  Concluído
                </button>
              </div>
            </div>
            <div className="mt-2 grid flex-1 grid-cols-2 gap-2">
              {projects.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => onOpenModal("project", p)}
                  className="flex flex-col items-start rounded-lg border border-[#262636] bg-[#1B1B29]/30 p-2 text-left transition-colors hover:border-[#34344A]"
                >
                  <span className="rounded-full bg-[#FF9A5A]/15 px-1.5 py-0.5 text-[8px] font-semibold text-[#FF9A5A]">
                    {p.status}
                  </span>
                  <p className="mt-1 text-[11px] font-medium">{p.title}</p>
                  <p className="text-[9px] text-[#67667C]">Atualizado {p.updated}</p>
                  <span className="mt-0.5 text-[9px] text-[#9997AE]">+{p.collaborators}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="shrink-0 rounded-xl border border-[#262636] bg-[#14141F] p-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold tracking-tight">Rascunho</h2>
              <button
                onClick={() => onOpenModal("continue-production")}
                className="flex items-center gap-1 rounded-full bg-[#7C5CFF] px-3 py-1 text-[10px] font-semibold text-white"
              >
                Continuar produção <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {drafts.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between border-b border-[#262636] py-1 last:border-0">
                  <div>
                    <p className="text-[10.5px] font-medium">{d.title}</p>
                    <p className="text-[9px] text-[#67667C]">Atualizado {d.updated}</p>
                  </div>
                  <button className="rounded-full bg-[#1B1B29] px-2 py-0.5 text-[9px] text-[#9997AE] hover:bg-[#262636]">
                    +1
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Edição rápida */}
        <div className="flex w-full flex-col gap-3 lg:w-1/3">
          <section className="flex flex-1 flex-col rounded-xl border border-[#262636] bg-[#14141F] p-3">
            <h2 className="font-display text-[13px] font-semibold tracking-tight">Edição rápida</h2>
            <div className="mt-2 grid grid-cols-4 gap-1 rounded-lg border border-[#262636] bg-[#1B1B29]/40 p-1">
              {["Imagem", "Texto", "Cores", "Elementos"].map((label) => (
                <button
                  key={label}
                  className="flex flex-col items-center gap-1 rounded-md py-1.5 text-[9px] font-medium text-[#67667C] transition-colors hover:text-[#9997AE]"
                >
                  {label === "Imagem" && <Brush className="h-3 w-3" />}
                  {label === "Texto" && <Type className="h-3 w-3" />}
                  {label === "Cores" && <Palette className="h-3 w-3" />}
                  {label === "Elementos" && <LayoutTemplate className="h-3 w-3" />}
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-1 items-center justify-center rounded-lg border border-[#262636] bg-gradient-to-br from-[#1B1B29] to-[#14141F]">
              <Brush className="h-6 w-6 text-[#67667C]" />
            </div>
            <button
              onClick={() => onOpenModal("replace-image")}
              className="mt-2 w-full rounded-lg border border-[#262636] py-1.5 text-[10px] font-medium text-[#9997AE] hover:bg-[#1B1B29]"
            >
              Substituir imagem
            </button>
            <div className="mt-3">
              <p className="mb-1 text-[10.5px] font-semibold">Ajustes</p>
              {[
                { label: "Brilho", value: 10 },
                { label: "Contraste", value: 8 },
                { label: "Saturação", value: 4 },
              ].map((s) => (
                <div key={s.label} className="mb-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] text-[#9997AE]">{s.label}</span>
                    <span className="font-mono text-[9px] text-[#67667C]">{s.value}</span>
                  </div>
                  <div className="h-1 rounded-full bg-[#1B1B29]">
                    <div className="h-full rounded-full bg-[#7C5CFF]" style={{ width: `${(s.value / 20) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-1 text-[9px] text-[#67667C] hover:text-[#9997AE]">Redefinir</button>
            <p className="mt-1 text-[9px] text-[#67667C]">
              Edição básica para ajustes rápidos. Para edições avançadas, abra o estúdio completo.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

// 3.2 STUDIO VIEW (com Briefing, Pipeline, Preview, Layers, Audit)
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
}: any) {
  const [leftTab, setLeftTab] = useState<"briefing" | "pipeline">("briefing")
  const [rightTab, setRightTab] = useState<"layers" | "audit">("layers")
  const [brief, setBrief] = useState("")

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[10.5px] font-medium text-[#9997AE] hover:text-[#F4F3FA]"
        >
          ← Voltar para o início
        </button>
        <div className="flex items-center gap-2 rounded-full border border-[#262636] bg-[#1B1B29] px-3 py-1.5">
          <Activity
            className={cn(
              "h-3.5 w-3.5",
              state.status === "running"
                ? "animate-pulse text-[#B892FF]"
                : state.status === "review"
                ? "animate-pulse text-[#FF9A5A]"
                : state.status === "done"
                ? "text-emerald-400"
                : "text-[#67667C]"
            )}
          />
          <span className="font-mono text-[11px] text-[#9997AE]">
            {state.status === "running"
              ? `produzindo · ${state.progress}%`
              : state.status === "review"
              ? "aguardando aprovação"
              : state.status === "done"
              ? "peça pronta"
              : "estúdio ocioso"}
          </span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-12">
        {/* Esquerda – Briefing / Pipeline */}
        <div className="flex min-h-0 flex-col gap-2 lg:col-span-5">
          <div className="grid shrink-0 grid-cols-2 gap-1 rounded-lg border border-[#262636] bg-[#1B1B29]/40 p-1">
            {[
              { id: "briefing", label: "Briefing" },
              { id: "pipeline", label: "Linha de produção" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setLeftTab(tab.id as typeof leftTab)}
                className={cn(
                  "rounded-md py-1.5 text-[11px] font-medium transition-colors",
                  leftTab === tab.id
                    ? "bg-[#7C5CFF] text-white"
                    : "text-[#9997AE] hover:text-[#F4F3FA]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
            {leftTab === "briefing" ? (
              <div className="space-y-3">
                <textarea
                  className="w-full rounded-lg border border-[#262636] bg-[#1B1B29] p-3 text-sm text-[#F4F3FA] placeholder:text-[#67667C]"
                  rows={5}
                  placeholder="Descreva sua ideia para a peça..."
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  disabled={running}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => onProduce(brief)}
                    disabled={!brief.trim() || running}
                    className="flex-1 rounded-full bg-[#7C5CFF] py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {running ? "Produzindo..." : "Iniciar produção"}
                  </button>
                  {running && (
                    <button
                      onClick={onStop}
                      className="rounded-full bg-[#FF5A5A] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Parar
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {SAMPLE_BRIEFS.map((sample, i) => (
                    <button
                      key={i}
                      onClick={() => setBrief(sample)}
                      className="rounded-full border border-[#262636] px-2 py-0.5 text-[9px] text-[#9997AE] hover:bg-[#1B1B29]"
                    >
                      Exemplo {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <PipelineTrack engineStatus={state.engineStatus} />
            )}
          </div>
        </div>

        {/* Centro – Pré-visualização */}
        <div className="min-h-0 lg:col-span-3">
          <ProductionPreview state={state} brandId={brandId} formatId={formatId} />
        </div>

        {/* Direita – Camadas / Auditoria */}
        <div className="flex min-h-0 flex-col gap-2 lg:col-span-4">
          <div className="grid shrink-0 grid-cols-2 gap-1 rounded-lg border border-[#262636] bg-[#1B1B29]/40 p-1">
            {[
              { id: "layers", label: "Camadas" },
              { id: "audit", label: "Auditoria" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRightTab(tab.id as typeof rightTab)}
                className={cn(
                  "rounded-md py-1.5 text-[11px] font-medium transition-colors",
                  rightTab === tab.id
                    ? "bg-[#7C5CFF] text-white"
                    : "text-[#9997AE] hover:text-[#F4F3FA]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
            {rightTab === "layers" ? (
              <LayersPanel
                doneLayers={state.doneLayers}
                layerVersions={state.layerVersions}
                logs={state.logs}
                onRefineLayer={onRefineLayer}
              />
            ) : (
              <AuditPanel
                gates={state.gates}
                auditLog={state.auditLog}
                status={state.status}
                onDecideGate={onDecideGate}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 4. COMPONENTES AUXILIARES DO STUDIO
// ============================================================

function PipelineTrack({ engineStatus }: { engineStatus: any }) {
  // Mapeia os módulos e seus motores
  const modules = MODULES.map((mod) => ({
    ...mod,
    engines: ENGINES.filter((e) => e.module === mod.id),
  }))

  return (
    <div className="flex flex-col gap-3">
      {modules.map((mod) => (
        <div key={mod.id} className="rounded-lg border border-[#262636] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium">{mod.name}</span>
            <span className="text-[9px] text-[#67667C]">{mod.role}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {mod.engines.map((eng) => {
              const status = engineStatus?.[eng.id] || "idle"
              const statusColor =
                status === "done"
                  ? "bg-emerald-400/20 text-emerald-300"
                  : status === "running"
                  ? "bg-[#B892FF]/20 text-[#B892FF] animate-pulse"
                  : "bg-[#262636] text-[#67667C]"
              return (
                <span
                  key={eng.id}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[8px] font-medium",
                    statusColor
                  )}
                >
                  {eng.name}
                </span>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function ProductionPreview({ state, brandId, formatId }: any) {
  const format = FORMATS.find((f) => f.id === formatId)
  const brand = BRAND_KITS.find((b) => b.id === brandId)

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-[#262636] bg-[#1B1B29]/30 p-2">
      <div
        className="relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-[#0B0B12]"
        style={{
          aspectRatio: format?.ratio === "9:16" ? "9/16" : "16/9",
          maxHeight: "100%",
        }}
      >
        {state.status === "idle" ? (
          <div className="flex flex-col items-center gap-2 text-[#67667C]">
            <Eye className="h-8 w-8" />
            <span className="text-xs">Pré-visualização</span>
          </div>
        ) : state.status === "running" ? (
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="h-8 w-8 animate-spin text-[#B892FF]" />
            <span className="text-xs text-[#9997AE]">Gerando peça...</span>
          </div>
        ) : state.status === "done" ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
            <span className="text-xs text-emerald-300">Peça pronta!</span>
          </div>
        ) : (
          <div className="text-xs text-[#9997AE]">{state.status}</div>
        )}
        {brand && (
          <div className="absolute bottom-1 right-1 rounded bg-black/50 px-1.5 py-0.5 text-[8px] text-[#9997AE]">
            {brand.name}
          </div>
        )}
        {format && (
          <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[8px] text-[#9997AE]">
            {format.name} · {format.ratio}
          </div>
        )}
      </div>
    </div>
  )
}

function LayersPanel({ doneLayers, layerVersions, logs, onRefineLayer }: any) {
  const layers = LAYERS.map((layer) => ({
    ...layer,
    done: doneLayers?.includes(layer.key) || false,
    version: layerVersions?.[layer.key] || 1,
  }))

  return (
    <div className="flex flex-col gap-2">
      {layers.map((layer) => (
        <div
          key={layer.key}
          className={cn(
            "flex items-center justify-between rounded-lg border p-2",
            layer.done ? "border-emerald-400/30 bg-emerald-400/5" : "border-[#262636]"
          )}
        >
          <div>
            <p className="text-[11px] font-medium">{layer.name}</p>
            <p className="text-[9px] text-[#67667C]">{layer.detail}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {layer.done ? (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-[#67667C]" />
            )}
            <span className="text-[9px] text-[#67667C]">v{layer.version}</span>
          </div>
        </div>
      ))}
      {logs && logs.length > 0 && (
        <div className="mt-2 rounded-lg border border-[#262636] bg-[#1B1B29]/30 p-2">
          <p className="text-[9px] font-medium text-[#9997AE]">Últimos logs</p>
          <ul className="mt-1 max-h-20 overflow-y-auto text-[9px] text-[#67667C]">
            {logs.slice(-3).map((log: string, i: number) => (
              <li key={i}>• {log}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function AuditPanel({ gates, auditLog, status, onDecideGate }: any) {
  return (
    <div className="flex flex-col gap-3">
      {AUDIT_GATES.map((gate) => {
        const result = gates?.[gate.id]?.result || "pending"
        return (
          <div
            key={gate.id}
            className={cn(
              "rounded-lg border p-2",
              result === "approved"
                ? "border-emerald-400/30 bg-emerald-400/5"
                : result === "rejected"
                ? "border-red-400/30 bg-red-400/5"
                : "border-[#262636]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium">{gate.name}</span>
              <span className="text-[9px] text-[#67667C]">{gate.threshold}%</span>
            </div>
            <ul className="mt-1 list-disc pl-4 text-[9px] text-[#67667C]">
              {gate.criteria.map((c: string) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            {status === "review" && result === "pending" && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onDecideGate(gate.id, "approved", "Lucas")}
                  className="flex-1 rounded-full bg-emerald-400/20 py-1 text-[10px] font-medium text-emerald-300"
                >
                  Aprovar
                </button>
                <button
                  onClick={() => onDecideGate(gate.id, "rejected", "Lucas")}
                  className="flex-1 rounded-full bg-red-400/20 py-1 text-[10px] font-medium text-red-300"
                >
                  Rejeitar
                </button>
              </div>
            )}
            {result !== "pending" && (
              <div className="mt-1 flex items-center gap-1">
                {result === "approved" ? (
                  <CheckCircle className="h-3 w-3 text-emerald-400" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-400" />
                )}
                <span className="text-[9px] text-[#67667C]">
                  {result === "approved" ? "Aprovado" : "Rejeitado"}
                </span>
              </div>
            )}
          </div>
        )
      })}
      {auditLog && auditLog.length > 0 && (
        <div className="rounded-lg border border-[#262636] p-2">
          <p className="text-[9px] font-medium text-[#9997AE]">Histórico</p>
          {auditLog.slice(-3).map((entry: any, i: number) => (
            <div key={i} className="text-[8px] text-[#67667C]">
              • {entry.gateId} – {entry.action} por {entry.reviewer}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 5. OUTRAS VIEWS (Vídeo, Peças, Pipeline, Consentimento, Arquitetura)
// ============================================================

function VideoLabView() {
  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="font-display text-lg font-semibold">Laboratório de Vídeo</h2>
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#262636] bg-[#14141F] p-4">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-[#B892FF]" />
            <h3 className="font-medium">Editor de vídeo</h3>
          </div>
          <div className="mt-4 flex aspect-video items-center justify-center rounded-lg bg-[#1B1B29] text-[#67667C]">
            <Play className="h-8 w-8" />
          </div>
          <div className="mt-3 flex gap-2">
            <button className="flex-1 rounded-lg border border-[#262636] py-1.5 text-sm text-[#9997AE]">
              Importar
            </button>
            <button className="flex-1 rounded-lg bg-[#7C5CFF] py-1.5 text-sm font-semibold text-white">
              Editar
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-[#262636] bg-[#14141F] p-4">
          <h3 className="font-medium">Biblioteca de mídia</h3>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-square rounded-lg bg-[#1B1B29]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function GraphicsLabView() {
  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="font-display text-lg font-semibold">Laboratório de Peças</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {FORMATS.map((f) => (
          <div key={f.id} className="rounded-xl border border-[#262636] bg-[#14141F] p-4 text-center">
            <LayoutTemplate className="mx-auto h-8 w-8 text-[#B892FF]" />
            <p className="mt-2 font-medium">{f.name}</p>
            <p className="text-xs text-[#67667C]">{f.ratio}</p>
            <button className="mt-2 w-full rounded-full bg-[#7C5CFF]/20 py-1 text-xs font-medium text-[#B892FF]">
              Criar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function RealPipelineView() {
  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="font-display text-lg font-semibold">Pipeline em tempo real</h2>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {MODULES.map((mod) => (
            <div key={mod.id} className="rounded-xl border border-[#262636] bg-[#14141F] p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{mod.name}</span>
                <span className="text-xs text-[#67667C]">{mod.role}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ENGINES.filter((e) => e.module === mod.id).map((eng) => (
                  <span
                    key={eng.id}
                    className="rounded-full bg-[#1B1B29] px-2 py-0.5 text-xs text-[#9997AE]"
                  >
                    {eng.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ConsentManagerView() {
  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="font-display text-lg font-semibold">Gerenciador de Consentimento</h2>
      <div className="rounded-xl border border-[#262636] bg-[#14141F] p-4">
        <h3 className="font-medium">Permissões de uso de imagem e voz</h3>
        <p className="mt-1 text-sm text-[#9997AE]">
          Gerencie os consentimentos para geração de avatares e locuções.
        </p>
        <div className="mt-4 space-y-2">
          {[
            { id: "1", name: "Avatar - João", status: "consentido" },
            { id: "2", name: "Avatar - Maria", status: "pendente" },
            { id: "3", name: "Voz - Locutor padrão", status: "consentido" },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-[#262636] p-2">
              <span className="text-sm">{item.name}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  item.status === "consentido"
                    ? "bg-emerald-400/20 text-emerald-300"
                    : "bg-amber-400/20 text-amber-300"
                )}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ArchitectureView() {
  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="font-display text-lg font-semibold">Arquitetura do Sistema</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#262636] bg-[#14141F] p-4">
          <h3 className="font-medium">Módulos</h3>
          <ul className="mt-2 space-y-1 text-sm text-[#9997AE]">
            {MODULES.map((m) => (
              <li key={m.id}>• {m.name} – {m.role}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[#262636] bg-[#14141F] p-4">
          <h3 className="font-medium">Motores de IA</h3>
          <ul className="mt-2 space-y-1 text-sm text-[#9997AE]">
            {ENGINES.slice(0, 6).map((e) => (
              <li key={e.id}>• {e.name} ({e.role})</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[#262636] bg-[#14141F] p-4">
          <h3 className="font-medium">Camadas</h3>
          <ul className="mt-2 space-y-1 text-sm text-[#9997AE]">
            {LAYERS.slice(0, 6).map((l) => (
              <li key={l.key}>• {l.name}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}