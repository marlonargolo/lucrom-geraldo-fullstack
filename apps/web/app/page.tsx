"use client"

import type { ReactNode, CSSProperties } from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight, Check, Mail } from "lucide-react"
import { motion, useScroll, useTransform } from "framer-motion"
import { Constellation3D } from "@/components/marketing/constellation-3d"
import { FaqAccordion, type FaqItem } from "@/components/marketing/faq-accordion"
import { LegalLinks } from "@/components/legal/legal-links"

// ─── Design System Override — Dala / Void ─────────────────────────────────
//
// Este arquivo substitui completamente o design anterior (light SaaS) pelo
// sistema visual Dala: void negro, constelação 3D de triângulos, tipografia
// monolítica em 400 com hierarquia por escala, acento violet (#8052ff) e
// amber (#ffb829). A paleta e os tokens são injetados inline via style tags
// para não depender de mudanças no globals.css que afetariam o /studio.
//
// Números de plano — manter em sincronia manual com:
//   apps/api/src/usage/usage.service.ts (PLAN_QUOTA_LIMITS)
//   apps/api/src/billing/plan-products.ts (PLAN_PRODUCTS — preço PRO/PLUS)
//   apps/api/src/billing/one-off-products.ts (ONE_OFF_PRODUCTS — avulso/pacote)
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_CREATOR_LIMIT = 3
const PLAN_PRO_LIMIT = 5
const PLAN_PLUS_LIMIT = 15
const PLAN_PRO_PRICE = "R$ 119"
const PLAN_PLUS_PRICE = "R$ 329"
const PLAN_AVULSO_PRICE = "R$ 29,90"
const PLAN_PACOTE5_PRICE = "R$ 134,90"
const SALES_EMAIL =
  "mailto:vendas@criatai.studio?subject=Plano%20Ag%C3%AAncia%2FEmpresa%20-%20Criatai"

const NAV_LINKS = [
  { href: "#pipeline", label: "Como funciona" },
  { href: "#precos", label: "Preços" },
  { href: "#faq", label: "Perguntas frequentes" },
] as const

const PIPELINE_STEPS = [
  {
    number: "01",
    label: "INFORMAÇÕES DO SEU NEGÓCIO",
    headline: "Escreva só duas frases.",
    body: "Diga qual é o seu tipo de negócio e a sua promoção. É só isso. Nosso sistema entende o seu produto e escolhe o melhor estilo de vídeo para você.",
    accent: "#8052ff",
  },
  {
    number: "02",
    label: "A CRIATAI FAZ O VÍDEO",
    headline: "Texto, voz e visual prontos.",
    body: "Nossa tecnologia cria a frase de impacto, o roteiro, legenda palavra por palavra, retira ruídos e gera imagens sob medida para o seu segmento. Tudo de forma automática.",
    accent: "#ffb829",
  },
  {
    number: "03",
    label: "PUBLICAÇÃO DIRETA",
    headline: "Direto no seu Instagram.",
    body: "Você lê a legenda, clica em aprovar e o vídeo vai para o ar no seu perfil. Não precisa baixar para o celular, nem abrir outro aplicativo.",
    accent: "#15846e",
  },
] as const

const FEATURES = [
  {
    tag: "SISTEMA SEMPRE NO AR",
    headline: "Nunca fica na mão.",
    body: "Usamos mais de uma tecnologia de geração de vídeo. Se um sistema instabilizar, outro assume na hora sem você nem perceber.",
  },
  {
    tag: "CONTADOR TRANSPARENTE",
    headline: "Você no controle.",
    body: "Acompanhe em tempo real quantos vídeos já criou no mês. Sem surpresas ou cobranças indevidas no final.",
  },
  {
    tag: "CONEXÃO SEGURA E OFICIAL",
    headline: "100% aprovado pela Meta.",
    body: "Conexão oficial com o Instagram. Sua conta fica totalmente segura, sem risco de bloqueio ou banimento.",
  },
  {
    tag: "PAGAMENTO FACILITADO",
    headline: "PIX ou Cartão de Crédito.",
    body: "Gere o QR Code e pague pelo celular. Seu plano ou vídeo extra é liberado em menos de 1 minuto.",
  },
] as const

const FAQ: FaqItem[] = [
  {
    question: "Preciso saber editar vídeo?",
    answer:
      "Não! Você só digita o que vende e a Criatai faz o roteiro, escolhe as imagens e monta a edição. O vídeo chega pronto.",
  },
  {
    question: "E se eu não gostar do texto gerado?",
    answer:
      "Você pode pedir para a inteligência reescrever ou você mesmo pode fazer ajustes rápidos no texto antes de gerar o vídeo.",
  },
  {
    question: "Preciso configurar alguma coisa complicada?",
    answer:
      "Não. Basta conectar a sua conta do Instagram em alguns cliques e pronto.",
  },
  {
    question: "Como funciona o pagamento?",
    answer: "Você pode pagar via PIX (com liberação imediata) ou Cartão de Crédito.",
  },
  {
    question: "Funciona para o meu tipo de negócio?",
    answer:
      "Sim! Serve para lojas físicas, e-commerce, prestadores de serviço, profissionais liberais, restaurantes e qualquer negócio que venda no Instagram.",
  },
]

// ─── Reveal ─────────────────────────────────────────────────────────────────
// Wrapper que anima entrada (fade + slide up) quando a seção entra na tela.
// Usado em todas as seções para dar sensação de movimento contínuo ao rolar.
function Reveal({
  children,
  delay = 0,
  y = 40,
  className,
  style,
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [breakpoint])
  return isMobile
}

function HeroContent() {
  const { scrollY } = useScroll()

  const yTitle = useTransform(scrollY, [0, 800], [0, -120])
  const yText = useTransform(scrollY, [0, 800], [0, -70])
  const yButtons = useTransform(scrollY, [0, 800], [0, -40])

  const opacity = useTransform(scrollY, [0, 500], [1, 0.4])

  const scale = useTransform(scrollY, [0, 800], [1, 0.92])

  return (
    <div style={{ paddingTop: 100 }}>
      {/* Wrapper de parallax (scroll) — sem initial/animate para não
          colidir com a animação de entrada, evitando mismatch de
          hidratação entre servidor e cliente. */}
      <motion.div style={{ y: yText }}>
        <motion.p
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="t-label"
          style={{
            color: "var(--amber)",
            marginBottom: 24,
          }}
        >
          Criatai AI · Criação Rápida
        </motion.p>
      </motion.div>

      <motion.div style={{ y: yTitle, scale, opacity }}>
        <motion.h1
          className="t-display"
          style={{
            color: "var(--bone)",
            marginBottom: 32,
          }}
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 1,
            delay: 0.1,
          }}
        >
          Seu anúncio pronto e
          <span style={{ color: "var(--iris)" }}> publicado </span>
          em minutos.
        </motion.h1>
      </motion.div>

      <motion.div style={{ y: yText, opacity }}>
        <motion.p
          className="t-body"
          style={{
            color: "var(--mist)",
            maxWidth: 460,
            marginBottom: 40,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 1,
            delay: 0.3,
          }}
        >
          Você só diz o que vende. A inteligência da Criatai escreve a fala,
          monta o vídeo e posta direto no seu Instagram — sem precisar de agência,
          sem editar nada e sem perder tempo.
        </motion.p>
      </motion.div>

      <motion.div style={{ y: yButtons, opacity }}>
        <motion.div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            delay: 0.5,
          }}
        >
          <Link href="/studio" className="btn-iris">
            Criar anúncio grátis
            <ArrowRight size={16} />
          </Link>

          <a
            href="#pipeline"
            className="t-nav"
            style={{
              color: "var(--ash)",
              textDecoration: "none",
            }}
          >
            Ver como funciona ↓
          </a>
        </motion.div>
      </motion.div>

      <motion.p
        className="t-label"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        style={{
          color: "var(--ash)",
          marginTop: 28,
        }}
      >
          {PLAN_CREATOR_LIMIT} vídeos grátis por mês · Sem pedir cartão de crédito
      </motion.p>
    </div>
  )
}

export default function LandingPage() {
  const isMobile = useIsMobile()

  return (
    <>
      {/* ─── CSS Tokens locais (não afetam o /studio) ─── */}
      <style>{`
        .void-page {
          --void: #000000;
          --bone: #ffffff;
          --ash: #9a9a9a;
          --mist: #bdbdbd;
          --iris: #8052ff;
          --amber: #ffb829;
          --verdant: #15846e;
          --font-neo: 'Inter', ui-sans-serif, system-ui, sans-serif;
          background: var(--void);
          color: var(--bone);
          font-family: var(--font-neo);
        }
        .void-page * { box-sizing: border-box; }

        /* Typography scale */
        .t-display   { font-size: clamp(56px, 8vw, 113px); line-height: 1.05; letter-spacing: -0.04em; font-weight: 400; }
        .t-heading-lg{ font-size: clamp(42px, 6vw, 78px);  line-height: 1.08; letter-spacing: -0.04em; font-weight: 400; }
        .t-heading   { font-size: clamp(32px, 4.5vw, 48px); line-height: 1.1; letter-spacing: -0.03em; font-weight: 400; }
        .t-subheading{ font-size: clamp(24px, 3vw, 36px);  line-height: 1.2; letter-spacing: -0.02em; font-weight: 400; }
        .t-body      { font-size: 18px; line-height: 1.6; font-weight: 200; }
        .t-nav       { font-size: 14px; line-height: 1.2; letter-spacing: 0.025em; font-weight: 600; text-transform: uppercase; }
        .t-label     { font-size: 12px; line-height: 1.2; letter-spacing: 0.025em; font-weight: 600; text-transform: uppercase; }

        /* Button */
        .btn-iris {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--iris); color: #fff; border: none;
          border-radius: 9999px; padding: 14px 28px;
          font-family: var(--font-neo); font-size: 14px; font-weight: 600;
          letter-spacing: 0.025em; text-transform: uppercase; text-decoration: none;
          transition: opacity 0.15s; cursor: pointer;
        }
        .btn-iris:hover { opacity: 0.85; }

        /* Divider */
        .void-divider { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 0; }

        /* Nav */
        .void-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 50;
          display: flex; align-items: center; padding: 20px 40px;
          background: rgba(0,0,0,0.72); backdrop-filter: blur(16px);
        }
        @media(max-width:640px){ .void-nav{ padding: 14px 16px; } }

        .nav-links { display: flex; gap: 32px; margin-left: 48px; }
        @media(max-width:860px){ .nav-links{ display: none; } }

        .nav-cta { padding: 10px 20px; font-size: 13px; }
        @media(max-width:480px){ .nav-cta{ padding: 8px 14px; font-size: 11px; } }

        .nav-logo-text { font-size: 32px; }
        @media(max-width:480px){ .nav-logo-text{ font-size: 22px; } }

        /* Seções */
        .void-section {
          max-width: 1280px; margin: 0 auto; padding: 0 40px;
        }
        @media(max-width:640px){ .void-section{ padding: 0 20px; } }

        /* Hero grid (desktop) */
        section[data-hero] {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 40px;
          align-items: center;
          min-height: 80vh;
          overflow: hidden;
        }
        @media(max-width:640px){
          section[data-hero]{ padding: 0 20px; }
        }
        @media(max-width:860px){
          section[data-hero] {
            grid-template-columns: 1fr !important;
            padding-top: 120px !important;
            padding-bottom: 60px !important;
            min-height: auto !important;
          }
        }

        /* Grids que usam auto-fit já colapsam para 1 coluna sozinhos,
           mas reduzimos o gap em telas muito pequenas para compactar. */
        @media(max-width:480px){
          .t-body { font-size: 16px; }
        }
      `}</style>

      <div className="void-page" style={{ minHeight: "100vh", position: "relative" }}>
        {/* ─── Constelação 3D — fundo fixo de toda a página ───
            Fica atrás de todo o conteúdo (z-index 0) e reage ao scroll:
            gira/inclina conforme o usuário rola a página, dando a
            sensação de que o objeto "acompanha" a rolagem inteira,
            não apenas o hero. */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            opacity: 0.9,
          }}
        >
          <Constellation3D
            particleCount={isMobile ? 900 : 2200}
            ambientCount={isMobile ? 100 : 260}
            scrollRotationTurns={isMobile ? 0.8 : 1.5}
            className="w-full h-full"
          />
        </div>

        {/* Conteúdo por cima do fundo */}
        <div style={{ position: "relative", zIndex: 1 }}>
        {/* ─── Navigation ─── */}
        <nav className="void-nav">
          {/* Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <svg
              width="42"
              height="42"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="criataiGradient" x1="0" y1="0" x2="64" y2="64">
                  <stop offset="0%" stopColor="#A855F7" />
                  <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
              </defs>

              {/* C */}
              <path
                d="M48.5 15.5C44.5 11.5 38.8 9 32 9C19.3 9 9 19.3 9 32C9 44.7 19.3 55 32 55C38.8 55 44.5 52.5 48.5 48.5L42 42C39.3 44.7 35.9 46 32 46C24.3 46 18 39.7 18 32C18 24.3 24.3 18 32 18C35.9 18 39.3 19.3 42 22L48.5 15.5Z"
                fill="url(#criataiGradient)"
              />

              {/* Estrela */}
              <path
                d="M32 22L34.6 29.4L42 32L34.6 34.6L32 42L29.4 34.6L22 32L29.4 29.4L32 22Z"
                fill="white"
              />
            </svg>

            <span
              className="nav-logo-text"
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 700,
                color: "#FFFFFF",
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              criatai
              <span style={{ color: "#7C3AED" }}>.</span>
            </span>
          </div>

          {/* Links */}
          <div className="nav-links">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="t-nav"
                style={{
                  color: "var(--ash)",
                  textDecoration: "none",
                  transition: "color 0.15s",
                }}
              >
                {l.label}
              </a>
            ))}
          </div>

          <div style={{ marginLeft: "auto" }}>
            <Link href="/studio" className="btn-iris nav-cta">
              Entrar na Criatai
            </Link>
          </div>
        </nav>

        {/* ─── Hero ─── */}
        <section data-hero>
          <motion.div
            animate={{
              x: [0, 60, -60, 0],
              y: [0, -40, 30, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              position: "absolute",
              width: 700,
              height: 700,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(124,58,237,.25) 0%, transparent 70%)",
              filter: "blur(120px)",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />

          {/* Coluna esquerda — copy */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <HeroContent />
          </div>

          {/* Coluna direita — espaço reservado; a constelação 3D agora vive
              fixa no fundo de toda a página (ver <ConstellationBackdrop />
              logo após a tag <body>/root do componente), então aqui deixamos
              apenas o espaço em branco para manter o grid 2 colunas do hero */}
          <div
            aria-hidden="true"
            style={{
              height: "clamp(400px, 60vh, 700px)",
              position: "relative",
              zIndex: 1,
            }}
          />
        </section>

        <hr className="void-divider" />

        {/* ─── Pipeline ─── */}
        <section
          id="pipeline"
          className="void-section"
          style={{ paddingTop: "clamp(56px, 10vw, 120px)", paddingBottom: "clamp(56px, 10vw, 120px)" }}
        >
          <Reveal>
            <p className="t-label" style={{ color: "var(--amber)", marginBottom: 20 }}>
              Como funciona
            </p>
            <h2 className="t-heading-lg" style={{ maxWidth: 620, marginBottom: 80 }}>
              Três passos simples.<br />
              <span style={{ color: "var(--ash)" }}>Da sua ideia direto pro Instagram.</span>
            </h2>
          </Reveal>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 60,
            }}
          >
            {PIPELINE_STEPS.map((step, i) => (
              <Reveal key={step.number} delay={i * 0.12}>
                <div style={{ borderTop: `1px solid ${step.accent}`, paddingTop: 24 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 20 }}>
                    <span
                      className="t-display"
                      style={{ color: step.accent, opacity: 0.25, lineHeight: 1, fontSize: "clamp(40px, 5vw, 64px)" }}
                    >
                      {step.number}
                    </span>
                    <span className="t-label" style={{ color: step.accent }}>
                      {step.label}
                    </span>
                  </div>
                  <h3 className="t-subheading" style={{ marginBottom: 16 }}>
                    {step.headline}
                  </h3>
                  <p className="t-body" style={{ color: "var(--ash)", fontSize: 16 }}>
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <hr className="void-divider" />

        {/* ─── Features ─── */}
        <section
          className="void-section"
          style={{ paddingTop: "clamp(56px, 10vw, 120px)", paddingBottom: "clamp(56px, 10vw, 120px)" }}
        >
          <Reveal>
            <h2 className="t-heading" style={{ marginBottom: 80, maxWidth: 500 }}>
              Feito para rodar todo dia,{" "}
              <span style={{ color: "var(--ash)" }}>sem complicação.</span>
            </h2>
          </Reveal>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1px",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            {FEATURES.map((f, i) => (
              <Reveal key={f.tag} delay={i * 0.08} y={24}>
                <div
                  style={{
                    background: "var(--void)",
                    padding: "40px 36px",
                    height: "100%",
                  }}
                >
                  <p className="t-label" style={{ color: "var(--iris)", marginBottom: 16 }}>
                    {f.tag}
                  </p>
                  <h3 style={{ fontSize: 20, fontWeight: 400, marginBottom: 12, lineHeight: 1.3 }}>
                    {f.headline}
                  </h3>
                  <p className="t-body" style={{ color: "var(--ash)", fontSize: 15 }}>
                    {f.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <hr className="void-divider" />

        {/* ─── Preços ─── */}
        <section
          id="precos"
          className="void-section"
          style={{ paddingTop: "clamp(56px, 10vw, 120px)", paddingBottom: "clamp(56px, 10vw, 120px)" }}
        >
          <Reveal>
            <p className="t-label" style={{ color: "var(--amber)", marginBottom: 20 }}>
              Preços
            </p>
            <h2 className="t-heading-lg" style={{ marginBottom: 16 }}>
              Simples e sem letras miúdas.
            </h2>
            <p className="t-body" style={{ color: "var(--ash)", marginBottom: 80 }}>
              Escolha o plano ideal para a quantidade de vídeos que você quer postar por mês.
            </p>
          </Reveal>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1px",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            {/* Grátis */}
            <Reveal delay={0} y={24} style={{ height: "100%" }}>
              <PricingCard
                tier="GRÁTIS"
                price="R$ 0"
                highlight={false}
                items={[
                  `${PLAN_CREATOR_LIMIT} vídeos com IA por mês`,
                  "Com marca d'água",
                  "Publicação direta no Instagram",
                  "Sem pedir cartão de crédito",
                ]}
                cta={{ label: "Começar grátis", href: "/studio" }}
              />
            </Reveal>

            {/* Avulso */}
            <Reveal delay={0.08} y={24} style={{ height: "100%" }}>
              <PricingCard
                tier="VÍDEO AVULSO"
                price={PLAN_AVULSO_PRICE}
                priceSuffix=" / vídeo"
                highlight={false}
                items={[
                  "1 vídeo extra, sem marca d'água",
                  "Ideal para usar quando o plano grátis acabar",
                  "Pagamento via PIX ou Cartão",
                ]}
                cta={{ label: "Comprar 1 vídeo", href: "/studio?buy=avulso" }}
              />
            </Reveal>

            {/* Pacote 5 */}
            <Reveal delay={0.16} y={24} style={{ height: "100%" }}>
              <PricingCard
                tier="PACOTE 5 VÍDEOS"
                price={PLAN_PACOTE5_PRICE}
                priceSuffix=" / pacote"
                highlight={false}
                items={[
                  "5 vídeos de até 60 segundos",
                  "Sem marca d'água",
                  "Os vídeos não expiram no fim do mês",
                  "Compra única, sem mensalidade",
                ]}
                cta={{ label: "Comprar pacote", href: "/studio?buy=pacote5" }}
              />
            </Reveal>

            {/* PRO */}
            <Reveal delay={0.24} y={24} style={{ height: "100%" }}>
              <PricingCard
                tier="PLANO PRO"
                price={PLAN_PRO_PRICE}
                priceSuffix=" / mês"
                highlight={false}
                items={[
                  `${PLAN_PRO_LIMIT} vídeos com IA por mês`,
                  "Sem marca d'água",
                  "Publicação direta no Instagram",
                  "Cancele quando quiser",
                ]}
                badge="Mais escolhido"
                cta={{ label: "Assinar Pro", href: "/studio" }}
              />
            </Reveal>

            {/* PLUS — destaque */}
            <Reveal delay={0.28} y={24} style={{ height: "100%" }}>
              <PricingCard
                tier="PLANO PLUS"
                price={PLAN_PLUS_PRICE}
                priceSuffix=" / mês"
                highlight={true}
                items={[
                  `${PLAN_PLUS_LIMIT} vídeos com IA por mês`,
                  "Sem marca d'água",
                  "Publicação direta no Instagram",
                  "Cancele quando quiser",
                ]}
                cta={{ label: "Assinar Plus", href: "/studio" }}
              />
            </Reveal>

            {/* Enterprise */}
            <Reveal delay={0.32} y={24} style={{ height: "100%" }}>
              <div style={{ background: "var(--void)", padding: "40px 36px", height: "100%" }}>
                <p className="t-label" style={{ color: "var(--verdant)", marginBottom: 20 }}>
                  PARA AGÊNCIAS E EMPRESAS
                </p>
                <p
                  style={{
                    fontSize: "clamp(28px, 4vw, 40px)",
                    fontWeight: 400,
                    letterSpacing: "-0.02em",
                    marginBottom: 24,
                    lineHeight: 1.1,
                  }}
                >
                  Sob consulta
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {["Grande volume de vídeos por mês", "Gerenciamento de múltiplas marcas ou perfis", "Atendimento e suporte dedicado"].map((item) => (
                    <li key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Check size={14} color="var(--verdant)" />
                      <span style={{ color: "var(--ash)", fontSize: 15 }}>{item}</span>
                    </li>
                  ))}
                </ul>
                <a href={SALES_EMAIL} className="t-nav" style={{ color: "var(--verdant)", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                  <Mail size={14} />
                  Falar com a equipe
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        <hr className="void-divider" />

        {/* ─── FAQ ─── */}
        <section
          id="faq"
          className="void-section"
          style={{ paddingTop: "clamp(56px, 10vw, 120px)", paddingBottom: "clamp(56px, 10vw, 120px)", maxWidth: 800 }}
        >
          <Reveal>
          <p className="t-label" style={{ color: "var(--amber)", marginBottom: 20 }}>
            FAQ
          </p>
          <h2 className="t-heading" style={{ marginBottom: 60 }}>
            Perguntas frequentes.
          </h2>
          </Reveal>
          {/* FaqAccordion com override de cores para o tema void */}
          <style>{`
            .void-faq [data-radix-accordion-item],
            .void-faq details {
              border-color: rgba(255,255,255,0.07) !important;
            }
            .void-faq [data-radix-accordion-trigger],
            .void-faq summary {
              color: var(--bone) !important;
              font-weight: 400 !important;
              font-size: 16px !important;
            }
            .void-faq [data-radix-accordion-content] p,
            .void-faq [data-radix-accordion-content],
            .void-faq details p {
              color: var(--ash) !important;
              font-weight: 200 !important;
            }
          `}</style>
          <Reveal delay={0.1}>
            <div className="void-faq">
              <FaqAccordion items={FAQ} />
            </div>
          </Reveal>
        </section>

        <hr className="void-divider" />

        {/* ─── CTA Final ─── */}
        <section
          className="void-section"
          style={{ paddingTop: "clamp(56px, 10vw, 120px)", paddingBottom: "clamp(64px, 11vw, 140px)", textAlign: "left" }}
        >
          <Reveal>
            <p className="t-label" style={{ color: "var(--amber)", marginBottom: 24 }}>
              Comece agora
            </p>
            <h2 className="t-heading-lg" style={{ maxWidth: 640, marginBottom: 48 }}>
              Seu próximo anúncio pode estar no ar em{" "}
              <span style={{ color: "var(--iris)" }}>3 minutos.</span>
            </h2>
            <Link href="/studio" className="btn-iris" style={{ fontSize: 15, padding: "16px 32px" }}>
              Criar meu primeiro anúncio grátis
              <ArrowRight size={18} />
            </Link>
          </Reveal>
        </section>

        {/* ─── Footer ─── */}
        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div
            className="void-section"
            style={{ paddingTop: "clamp(40px, 7vw, 60px)", paddingBottom: "clamp(40px, 7vw, 60px)" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 40,
                marginBottom: 48,
              }}
            >
              <Reveal delay={0}>
                <div>
                  <p className="t-nav" style={{ color: "var(--bone)", marginBottom: 12 }}>
                    CRIATAI<span style={{ color: "var(--iris)" }}>.</span>
                  </p>
                  <p style={{ color: "var(--ash)", fontSize: 13, lineHeight: 1.6 }}>
                    Divulgação inteligente para o micro e pequeno empreendedor brasileiro.
                  </p>
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                <div>
                  <p className="t-label" style={{ color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>
                    Produto
                  </p>
                  <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { href: "#pipeline", label: "Como funciona" },
                      { href: "#precos", label: "Preços" },
                      { href: "/studio", label: "Entrar na conta" },
                    ].map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        style={{ color: "var(--ash)", textDecoration: "none", fontSize: 14 }}
                      >
                        {l.label}
                      </a>
                    ))}
                  </nav>
                </div>
              </Reveal>

              <Reveal delay={0.16}>
                <div>
                  <p className="t-label" style={{ color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>
                    Ajuda
                  </p>
                  <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { href: "#faq", label: "Perguntas frequentes" },
                      { href: SALES_EMAIL, label: "Falar com vendas" },
                    ].map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        style={{ color: "var(--ash)", textDecoration: "none", fontSize: 14 }}
                      >
                        {l.label}
                      </a>
                    ))}
                  </nav>
                </div>
              </Reveal>
            </div>

            <LegalLinks variant="marketing" className="mb-6" />

            <Reveal delay={0.05} y={16}>
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                paddingTop: 24,
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <p className="t-label" style={{ color: "rgba(255,255,255,0.2)" }}>
                © {new Date().getFullYear()} Criatai
              </p>
              <p className="t-label" style={{ color: "rgba(255,255,255,0.2)" }}>
                Feito para o empreendedor brasileiro.
              </p>
            </div>
            </Reveal>
          </div>
        </footer>
        </div>
        {/* fim da div de conteúdo (zIndex: 1) */}
      </div>
    </>
  )
}

// ─── PricingCard ─────────────────────────────────────────────────────────────
function PricingCard({
  tier,
  price,
  priceSuffix,
  highlight,
  badge,
  items,
  cta,
}: {
  tier: string
  price: string
  priceSuffix?: string
  highlight: boolean
  badge?: string
  items: string[]
  cta: { label: string; href: string }
}) {
  return (
    <div
      style={{
        background: highlight ? "rgba(128,82,255,0.06)" : "var(--void)",
        padding: "40px 36px",
        position: "relative",
        borderTop: highlight ? "1px solid var(--iris)" : "none",
        height: "100%",
      }}
    >
      {badge && (
        <span
          style={{
            position: "absolute",
            top: -12,
            left: 36,
            background: "var(--iris)",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "4px 10px",
            borderRadius: 9999,
          }}
        >
          {badge}
        </span>
      )}

      <p
        className="t-label"
        style={{ color: highlight ? "var(--iris)" : "var(--ash)", marginBottom: 20 }}
      >
        {tier}
      </p>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 24 }}>
        <span
          style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {price}
        </span>
        {priceSuffix && (
          <span style={{ color: "var(--ash)", fontSize: 14 }}>{priceSuffix}</span>
        )}
      </div>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 32px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {items.map((item) => (
          <li key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Check size={14} color={highlight ? "var(--iris)" : "var(--ash)"} />
            <span style={{ color: "var(--ash)", fontSize: 15 }}>{item}</span>
          </li>
        ))}
      </ul>

      <Link
        href={cta.href}
        className={highlight ? "btn-iris" : ""}
        style={
          highlight
            ? {}
            : {
                display: "inline-flex",
                alignItems: "center",
                color: "var(--ash)",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                letterSpacing: "0.025em",
                textTransform: "uppercase",
              }
        }
      >
        {cta.label}
      </Link>
    </div>
  )
}