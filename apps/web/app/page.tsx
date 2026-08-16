import Link from "next/link"
import {
  ArrowRight,
  Zap,
  ShieldCheck,
  QrCode,
  Send,
  Wand2,
  Share2,
  Check,
  MessageSquareText,
  Sparkles,
  CalendarClock,
  Store,
  Scissors,
  ShoppingBag,
  Wrench,
  ShoppingCart,
  Users,
  Star,
  Mail,
} from "lucide-react"
import { HeroSlate } from "@/components/marketing/hero-slate"
import { FaqAccordion, type FaqItem } from "@/components/marketing/faq-accordion"
import { BrandMark } from "@/components/studio/brand-mark"

// ─── Migração Visual — Light Theme ─────────────────────────────────────────
//
// Esta página é a mesma fanpage de antes, reestruturada visualmente pro
// padrão SaaS claro pedido (ver Módulo de Migração Visual) e reorganizada no
// tamanho da imagem de referência (nav com âncoras, nichos, "como funciona"
// em cards, preços com plano em destaque, depoimentos, rodapé em colunas).
//
// Nenhum dado novo foi inventado onde existe responsabilidade funcional —
// todo CTA leva a um destino real (/studio, mailto:vendas@... — o mesmo
// e-mail já usado em components/studio/quota-badge.tsx) e todo número de
// plano vem das MESMAS constantes de antes, sincronizadas manualmente com
// apps/api/src/usage/usage.service.ts (PLAN_QUOTA_LIMITS) e
// apps/web/app/api/billing/checkout/route.ts (BILLING_PRO_PLAN_PRICE_CENTS).
//
// Duas diferenças deliberadas em relação à imagem de referência, registradas
// aqui pra quem for revisar:
//   1. A imagem mostra 4 planos; o backend só tem 3 tiers reais (CREATOR
//      grátis, PRO pago com checkout, ENTERPRISE sem preço fixo — "fale com
//      o time"). Em vez de inventar 2 planos com botão de assinar que não
//      levaria a lugar nenhum, os 3 planos reais ganharam o mesmo tratamento
//      visual (plano do meio em destaque, badge "Mais escolhido").
//   2. Os depoimentos abaixo são PLACEHOLDER — não existe nenhum depoimento
//      real no código ou banco. A seção já está pronta no layout final;
//      troque `TESTIMONIALS` por depoimentos reais antes de publicar.

// Números reais dos planos — mantenha em sincronia manual com
// apps/api/src/usage/usage.service.ts (PLAN_QUOTA_LIMITS) e
// apps/web/app/api/billing/checkout/route.ts (BILLING_PRO_PLAN_PRICE_CENTS).
//
// CORREÇÃO (auditoria financeira): este valor estava em 5, mas o backend
// (PLAN_QUOTA_LIMITS.CREATOR em usage.service.ts) sempre limitou o plano
// gratuito a 1 geração/mês — a landing prometia 4 gerações que o sistema
// jamais entregaria. Ajustado para refletir a regra real de negócio.
const PLAN_CREATOR_LIMIT = 1
const PLAN_PRO_LIMIT = 100
const PLAN_PRO_PRICE = "R$ 49,90"
const PLAN_AVULSO_PRICE = "R$ 39,90"
const PLAN_PACOTE5_PRICE = "R$ 179,90"
// Mesmo e-mail de vendas usado em components/studio/quota-badge.tsx
// (DEFAULT_UPGRADE_EMAIL) — mantenha os dois em sincronia manual.
const SALES_EMAIL = "mailto:vendas@lucrom.studio?subject=Plano%20Ag%C3%AAncia%2FEmpresa%20-%20Lucrom%20Studio"

const NAV_LINKS = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#precos", label: "Preços" },
  { href: "#faq", label: "Ajuda" },
] as const

const NICHES = [
  { icon: Store, label: "Restaurantes", detail: "Bares e lanchonetes" },
  { icon: Scissors, label: "Salões", detail: "Beleza e estética" },
  { icon: ShoppingBag, label: "Lojas", detail: "Comércio em geral" },
  { icon: Wrench, label: "Serviços", detail: "Prestadores" },
  { icon: ShoppingCart, label: "E-commerce", detail: "Loja virtual" },
  { icon: Users, label: "Profissionais", detail: "Liberais" },
] as const

// Mesmos 3 passos reais de antes — só ganharam o tratamento visual de card
// numerado com conector, no lugar da lista corrida.
const STEPS = [
  {
    number: "1",
    label: "VOCÊ DIZ O QUE VENDE",
    title: "Duas frases, não um briefing",
    body: "Tipo de negócio e oferta. “Hamburgueria artesanal”, “Combo R$25”. Só isso — sem formulário longo, sem enviar foto, sem esperar orçamento.",
    icon: MessageSquareText,
    accent: "green",
  },
  {
    number: "2",
    label: "A IA ESCREVE O ROTEIRO",
    title: "Gancho, oferta e chamada prontos",
    body: "Uma única chamada de IA devolve o gancho de impacto, a apresentação da oferta e a chamada para ação — já no formato certo pros primeiros segundos de um Reels.",
    icon: Sparkles,
    accent: "purple",
  },
  {
    number: "3",
    label: "O VÍDEO VAI PRO INSTAGRAM",
    title: "Publicado, não só baixado",
    body: "O Reels é gerado e publicado direto na sua conta do Instagram — você revisa a legenda antes, mas não precisa exportar, salvar e subir na mão.",
    icon: CalendarClock,
    accent: "blue",
  },
] as const

const ACCENT_CLASSES: Record<string, string> = {
  green: "bg-primary/10 text-primary",
  purple: "bg-(--lucrom-purple)/10 text-(--lucrom-purple)",
  blue: "bg-(--lucrom-blue)/10 text-(--lucrom-blue)",
}

const FEATURES = [
  {
    icon: Zap,
    title: "Nunca fica parado sem gerar",
    body: "Se o provedor de IA pago estiver fora do ar, o sistema cai automaticamente para um modelo gratuito — você sempre sai com um anúncio pronto.",
  },
  {
    icon: ShieldCheck,
    title: "Você vê exatamente quanto usou",
    body: "Um contador simples mostra suas gerações do mês em tempo real. Sem letra miúda, sem descobrir o limite só quando ele estoura.",
  },
  {
    icon: Share2,
    title: "Publicação de verdade, não só exportação",
    body: "Integração direta com a Graph API do Instagram — o vídeo sai do Lucrom Studio e entra no seu perfil, com as três etapas de publicação conferidas.",
  },
  {
    icon: QrCode,
    title: "PIX ou cartão, sem burocracia",
    body: "Upgrade de plano com QR Code na hora ou link de pagamento seguro. Sem contrato, sem ligação de vendedor.",
  },
] as const

// PLACEHOLDER — nenhum depoimento real existe hoje no código/banco. Troque
// por depoimentos reais (com autorização do cliente) antes de publicar.
const TESTIMONIALS = [
  {
    name: "Carlos",
    role: "Hamburgueria · Belo Horizonte, MG",
    quote: "Em uma semana já vi diferença nas vendas. Os vídeos ficam profissionais e é muito fácil de usar.",
  },
  {
    name: "Ana",
    role: "Salão de beleza · Curitiba, PR",
    quote: "É como ter uma agência, mas por um preço que cabe no meu bolso.",
  },
  {
    name: "Marina",
    role: "Loja de roupas · São Paulo, SP",
    quote: "Parei de perder tempo. A IA faz o trabalho pesado e eu só colho os resultados.",
  },
] as const

const FAQ: FaqItem[] = [
  {
    question: "Preciso saber editar vídeo ou programar?",
    answer:
      "Não. Você digita o tipo de negócio e a oferta, e o Lucrom Studio cuida do roteiro, das imagens e da montagem do vídeo.",
  },
  {
    question: "E se eu não gostar do texto que a IA escreveu?",
    answer:
      "Você pode editar o gancho, a oferta e a chamada livremente antes de gerar o vídeo final — a IA dá o ponto de partida, a palavra final é sua.",
  },
  {
    question: "Preciso configurar alguma chave de API pra usar?",
    answer:
      "Não. O plano gratuito já funciona sem nenhuma configuração — o sistema usa um provedor de IA gratuito por padrão.",
  },
  {
    question: "Vocês publicam automaticamente ou eu que subo o vídeo?",
    answer:
      "O Lucrom Studio publica direto na sua conta do Instagram através da API oficial da Meta. Você revisa antes de publicar.",
  },
  {
    question: "Como funciona o pagamento do plano PRO?",
    answer: `Via Mercado Pago, direto na plataforma — PIX com QR Code na hora ou cartão de crédito. ${PLAN_PRO_PRICE}/mês por ${PLAN_PRO_LIMIT} gerações.`,
  },
  {
    question: "Funciona para qualquer tipo de negócio?",
    answer:
      "Sim. Hamburgueria, salão de beleza, eletricista, qualquer MEI que precise anunciar uma oferta específica de forma rápida.",
  },
]

export default function LandingPage() {
  return (
    <div className="lucrom-light min-h-screen bg-background text-foreground">
      {/* ─── Nav ─── */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3.5 sm:px-6">
          <BrandMark />

          <nav className="ml-2 hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/studio"
              className="hidden items-center rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-secondary sm:inline-flex"
            >
              Entrar
            </Link>
            <Link
              href="/studio"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Comece grátis
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="h-3 w-3" aria-hidden />
              Para MEI que vende de verdade
            </span>
            <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-balance text-foreground sm:text-5xl">
              O anúncio que seu concorrente <span className="text-primary">não fez</span> esta semana.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground text-pretty">
              Você digita o que vende. A IA escreve o gancho, gera o vídeo e publica no seu Instagram — sem
              agência, sem editor de vídeo, sem gastar rios de dinheiro.
            </p>

            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                Sem cartão de crédito
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                Sem editar vídeo na mão
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                Publica direto no Instagram
              </li>
            </ul>

            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:opacity-90"
              >
                Criar meu primeiro anúncio grátis
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                Ver como funciona
              </a>
            </div>
            <p className="mt-4 font-mono text-[11px] text-muted-foreground">
              {PLAN_CREATOR_LIMIT} vídeo grátis por mês · sem cartão de crédito
            </p>
          </div>

          <HeroSlate />
        </div>
      </section>

      {/* ─── Nichos ─── */}
      <section className="border-t border-border bg-secondary/60">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <p className="mb-6 text-center font-display text-sm font-bold text-foreground sm:text-left">
            Feito para quem faz o Brasil acontecer.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {NICHES.map((n) => (
              <div
                key={n.label}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <n.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{n.label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{n.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Como funciona ─── */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Como funciona</h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          As mesmas três etapas que rodam por trás de cada anúncio gerado na plataforma.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="relative rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${ACCENT_CLASSES[step.accent]}`}
              >
                <step.icon className="h-5 w-5" aria-hidden />
              </div>
              <div className="mb-2 flex items-baseline gap-2 font-mono text-[11px] text-muted-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-foreground">
                  {step.number}
                </span>
                <span>{step.label}</span>
              </div>
              <h3 className="font-display text-base font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Recursos ─── */}
      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Feito pra rodar todo mês, sem drama
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--lucrom-blue)/10 text-(--lucrom-blue)">
                  <f.icon className="h-4.5 w-4.5" aria-hidden />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Depoimentos (PLACEHOLDER — ver comentário no topo do arquivo) ─── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Quem usa, recomenda.
        </h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Histórias reais de quem já está vendendo mais com o Lucrom.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex gap-0.5 text-warning">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-foreground">“{t.quote}”</p>
              <div className="mt-4">
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Preço ───
       * 5 ofertas reais: 3 planos (CREATOR/PRO/ENTERPRISE) + 2 compras
       * avulsas sem assinatura (AVULSO 1 vídeo, PACOTE5 5 vídeos) — ver
       * apps/api/src/billing/one-off-products.ts para os valores/produtos
       * validados no backend (nunca confiar no preço vindo do cliente). */}
      <section id="precos" className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Preço simples, sem crédito misterioso
          </h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Um número de gerações por mês. Sem tabela de créditos por segundo de vídeo.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Grátis */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Grátis</p>
              <p className="mt-2 font-display text-3xl font-bold text-foreground">R$ 0</p>
              <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {PLAN_CREATOR_LIMIT} vídeo de IA por mês
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  Publicação direta no Instagram
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  Sem cartão de crédito
                </li>
              </ul>
              <Link
                href="/studio"
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                Começar grátis
              </Link>
            </div>

            {/* Avulso — compra de 1 vídeo extra sem assinatura */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Avulso</p>
              <p className="mt-2 font-display text-3xl font-bold text-foreground">
                {PLAN_AVULSO_PRICE}
                <span className="text-base font-medium text-muted-foreground">/vídeo</span>
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  1 vídeo extra, sem assinatura
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  Usa quando seu grátis do mês acabar
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  PIX ou cartão, sem compromisso
                </li>
              </ul>
              <Link
                href="/studio?buy=avulso"
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                Comprar 1 vídeo
              </Link>
            </div>

            {/* Pacote 5 — 5 vídeos de 60s, compra única */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Pacote 5 vídeos</p>
              <p className="mt-2 font-display text-3xl font-bold text-foreground">
                {PLAN_PACOTE5_PRICE}
                <span className="text-base font-medium text-muted-foreground">/pacote</span>
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  5 vídeos de até 60 segundos
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  Créditos não expiram no mês
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  Compra única, sem assinatura
                </li>
              </ul>
              <Link
                href="/studio?buy=pacote5"
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                Comprar pacote
              </Link>
            </div>

            {/* Pro — plano recomendado, roxo */}
            <div className="relative rounded-2xl border-2 border-(--lucrom-purple) bg-card p-6 shadow-lg shadow-(--lucrom-purple)/10">
              <span className="absolute -top-3 left-6 rounded-full bg-(--lucrom-purple) px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                Mais escolhido
              </span>
              <p className="font-mono text-[11px] uppercase tracking-widest text-(--lucrom-purple)">Pro</p>
              <p className="mt-2 font-display text-3xl font-bold text-foreground">
                {PLAN_PRO_PRICE}
                <span className="text-base font-medium text-muted-foreground">/mês</span>
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-(--lucrom-purple)" aria-hidden />
                  {PLAN_PRO_LIMIT} gerações de IA por mês
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-(--lucrom-purple)" aria-hidden />
                  Publicação direta no Instagram
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-(--lucrom-purple)" aria-hidden />
                  PIX ou cartão, cancele quando quiser
                </li>
              </ul>
              <Link
                href="/studio"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-(--lucrom-purple) px-4 py-2.5 text-sm font-semibold text-white hover:bg-(--lucrom-purple-vivid)"
              >
                <Wand2 className="h-4 w-4" aria-hidden />
                Assinar Pro
              </Link>
            </div>

            {/* Enterprise — fala com o time, azul */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="font-mono text-[11px] uppercase tracking-widest text-(--lucrom-blue)">Agência / Empresa</p>
              <p className="mt-2 font-display text-3xl font-bold text-foreground">Sob consulta</p>
              <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-(--lucrom-blue)" aria-hidden />
                  Volume alto de gerações por mês
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-(--lucrom-blue)" aria-hidden />
                  Múltiplas marcas/contas
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-(--lucrom-blue)" aria-hidden />
                  Suporte dedicado
                </li>
              </ul>
              <a
                href={SALES_EMAIL}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-(--lucrom-blue) px-4 py-2.5 text-sm font-semibold text-(--lucrom-blue) hover:bg-(--lucrom-blue)/5"
              >
                <Mail className="h-4 w-4" aria-hidden />
                Falar com o time
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Perguntas frequentes
        </h2>
        <div className="mt-8">
          <FaqAccordion items={FAQ} />
        </div>
      </section>

      {/* ─── CTA final ─── */}
      <section className="border-t border-border bg-secondary/60">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:px-6 sm:py-24">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Seu próximo anúncio pode estar pronto em 3 minutos.
          </h2>
          <Link
            href="/studio"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:opacity-90"
          >
            <Send className="h-4 w-4" aria-hidden />
            Criar meu primeiro anúncio grátis
          </Link>
        </div>
      </section>

      {/* ─── Rodapé ───
       * Propositalmente escuro (ver Módulo de Migração Visual, seção 9) —
       * cria contraste com o resto da página clara. Só links reais: âncoras
       * da própria página, /studio e o e-mail de vendas. Sem ícone de rede
       * social — não existe nenhum perfil oficial cadastrado no código pra
       * linkar de verdade. */}
      <footer className="bg-(--lucrom-footer-bg) text-white/70">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <span className="font-display text-sm font-bold tracking-tight text-white">
                LUCROM <span className="text-primary">Studio</span>
              </span>
              <p className="mt-2 text-xs leading-relaxed text-white/50">
                Marketing inteligente para o MEI brasileiro.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Produto</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a href="#como-funciona" className="hover:text-white">
                    Como funciona
                  </a>
                </li>
                <li>
                  <a href="#precos" className="hover:text-white">
                    Preços
                  </a>
                </li>
                <li>
                  <Link href="/studio" className="hover:text-white">
                    Entrar
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Ajuda</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a href="#faq" className="hover:text-white">
                    Perguntas frequentes
                  </a>
                </li>
                <li>
                  <a href={SALES_EMAIL} className="hover:text-white">
                    Falar com vendas
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/40">
            © {new Date().getFullYear()} Lucrom Studio. Feito para o MEI brasileiro.
          </div>
        </div>
      </footer>
    </div>
  )
}
