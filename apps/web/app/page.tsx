import Link from "next/link"
import { ArrowRight, Check, Mail } from "lucide-react"
import { Constellation3D } from "@/components/marketing/constellation-3d"
import { FaqAccordion, type FaqItem } from "@/components/marketing/faq-accordion"

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
//   apps/web/app/api/billing/checkout/route.ts (BILLING_PRO_PLAN_PRICE_CENTS)
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_CREATOR_LIMIT = 1
const PLAN_PRO_LIMIT = 100
const PLAN_PRO_PRICE = "R$ 49,90"
const PLAN_AVULSO_PRICE = "R$ 39,90"
const PLAN_PACOTE5_PRICE = "R$ 179,90"
const SALES_EMAIL =
  "mailto:vendas@lucrom.studio?subject=Plano%20Ag%C3%AAncia%2FEmpresa%20-%20Lucrom%20Studio"

const NAV_LINKS = [
  { href: "#pipeline", label: "Pipeline" },
  { href: "#precos", label: "Preços" },
  { href: "#faq", label: "FAQ" },
] as const

const PIPELINE_STEPS = [
  {
    number: "01",
    label: "BRIEFING",
    headline: "Duas frases.",
    body: "Tipo de negócio e oferta. Nada mais. O sistema lê, interpreta contexto e seleciona o modelo generativo certo.",
    accent: "#8052ff",
  },
  {
    number: "02",
    label: "IA GERA",
    headline: "Gancho, roteiro, vídeo.",
    body: "Pipeline M8 em quatro etapas: transcrição word-level, isolamento vocal, matting de fundo e geração de imagem por nicho. Tudo assíncrono.",
    accent: "#ffb829",
  },
  {
    number: "03",
    label: "PUBLICAÇÃO",
    headline: "Direto no Instagram.",
    body: "Graph API oficial da Meta. Você revisa a legenda, aprova — o sistema publica. Sem exportar, sem abrir o app.",
    accent: "#15846e",
  },
] as const

const FEATURES = [
  {
    tag: "RESILIÊNCIA",
    headline: "Circuit breaker automático.",
    body: "Kling AI primário, MiniMax como fallback. Se um cai, o outro assume sem latência visível.",
  },
  {
    tag: "TRANSPARÊNCIA",
    headline: "Contador em tempo real.",
    body: "Você vê exatamente quantas gerações usou no mês. Sem surpresa de limite estourado.",
  },
  {
    tag: "PUBLICAÇÃO",
    headline: "API oficial, não scraping.",
    body: "Integração direta com Meta Graph API — aprovada, estável e sem risco de ban de conta.",
  },
  {
    tag: "PAGAMENTO",
    headline: "PIX ou cartão.",
    body: "QR Code gerado na hora via Mercado Pago. Upgrade em menos de 60 segundos.",
  },
] as const

const FAQ: FaqItem[] = [
  {
    question: "Preciso saber editar vídeo?",
    answer:
      "Não. Você escreve o que vende e o pipeline cuida de roteiro, imagens e montagem. O resultado chega pronto para publicar.",
  },
  {
    question: "E se eu não gostar do texto gerado?",
    answer:
      "Edite antes de confirmar. A IA dá o ponto de partida — gancho, oferta e chamada — mas a palavra final é sempre sua.",
  },
  {
    question: "Preciso configurar chave de API?",
    answer:
      "Não. O plano gratuito funciona sem nenhuma configuração. O sistema usa nossos provedores de IA diretamente.",
  },
  {
    question: "Como funciona o pagamento?",
    answer: `Via Mercado Pago — PIX com QR Code ou cartão de crédito. Plano PRO custa ${PLAN_PRO_PRICE}/mês por ${PLAN_PRO_LIMIT} gerações.`,
  },
  {
    question: "Funciona para qualquer tipo de negócio?",
    answer:
      "Sim. Qualquer MEI com oferta específica: hamburguerias, salões, eletricistas, lojas, profissionais liberais.",
  },
]

export default function LandingPage() {
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
        @media(max-width:640px){ .void-nav{ padding: 16px 20px; } }

        /* Seções */
        .void-section {
          max-width: 1280px; margin: 0 auto; padding: 0 40px;
        }
        @media(max-width:640px){ .void-section{ padding: 0 20px; } }
      `}</style>

      <div className="void-page" style={{ minHeight: "100vh" }}>

        {/* ─── Navigation ─── */}
        <nav className="void-nav">
          {/* Logo */}
          <span className="t-nav" style={{ color: "var(--bone)", letterSpacing: "0.1em" }}>
            LUCROM<span style={{ color: "var(--iris)" }}>.</span>
          </span>

          {/* Links */}
          <div style={{ display: "flex", gap: 32, marginLeft: 48 }} className="hidden md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="t-nav"
                style={{ color: "var(--ash)", textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bone)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ash)")}
              >
                {l.label}
              </a>
            ))}
          </div>

          <div style={{ marginLeft: "auto" }}>
            <Link href="/studio" className="btn-iris" style={{ padding: "10px 20px", fontSize: 13 }}>
              Entrar no Studio
            </Link>
          </div>
        </nav>

        {/* ─── Hero ─── */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            minHeight: "100vh",
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 40px",
            alignItems: "center",
            gap: 60,
          }}
        >
          {/* Coluna esquerda — copy */}
          <div style={{ paddingTop: 100 }}>
            <p
              className="t-label"
              style={{ color: "var(--amber)", marginBottom: 24 }}
            >
              Studio AI · Pipeline M8
            </p>

            <h1 className="t-display" style={{ color: "var(--bone)", marginBottom: 32 }}>
              Seu anúncio gerado,{" "}
              <span style={{ color: "var(--iris)" }}>publicado</span>{" "}
              em minutos.
            </h1>

            <p
              className="t-body"
              style={{ color: "var(--mist)", maxWidth: 460, marginBottom: 40 }}
            >
              Você diz o que vende. O pipeline de IA escreve o roteiro, gera o vídeo
              e publica direto no Instagram — sem agência, sem editor, sem esperar.
            </p>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <Link href="/studio" className="btn-iris">
                Criar anúncio grátis
                <ArrowRight size={16} />
              </Link>
              <a
                href="#pipeline"
                className="t-nav"
                style={{ color: "var(--ash)", textDecoration: "none" }}
              >
                Ver pipeline →
              </a>
            </div>

            <p className="t-label" style={{ color: "var(--ash)", marginTop: 28, opacity: 0.6 }}>
              {PLAN_CREATOR_LIMIT} vídeo grátis/mês · sem cartão de crédito
            </p>
          </div>

          {/* Coluna direita — constelação 3D */}
          <div
            style={{
              height: "clamp(400px, 60vh, 700px)",
              position: "relative",
            }}
          >
            <Constellation3D
              particleCount={1800}
              ambientCount={220}
              className="w-full h-full"
            />
          </div>
        </section>

        {/* Mobile: constelação embaixo do hero copy (col-1 em mobile) */}
        <style>{`
          @media(max-width:860px){
            section[data-hero] {
              grid-template-columns: 1fr !important;
              padding-top: 100px !important;
            }
          }
        `}</style>

        <hr className="void-divider" />

        {/* ─── Pipeline ─── */}
        <section
          id="pipeline"
          className="void-section"
          style={{ paddingTop: 120, paddingBottom: 120 }}
        >
          <p className="t-label" style={{ color: "var(--amber)", marginBottom: 20 }}>
            Como funciona
          </p>
          <h2 className="t-heading-lg" style={{ maxWidth: 620, marginBottom: 80 }}>
            Três etapas.<br />
            <span style={{ color: "var(--ash)" }}>Do briefing ao Instagram.</span>
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 60,
            }}
          >
            {PIPELINE_STEPS.map((step) => (
              <div key={step.number} style={{ borderTop: `1px solid ${step.accent}`, paddingTop: 24 }}>
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
            ))}
          </div>
        </section>

        <hr className="void-divider" />

        {/* ─── Features ─── */}
        <section
          className="void-section"
          style={{ paddingTop: 120, paddingBottom: 120 }}
        >
          <h2 className="t-heading" style={{ marginBottom: 80, maxWidth: 500 }}>
            Feito pra rodar todo mês,{" "}
            <span style={{ color: "var(--ash)" }}>sem drama.</span>
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1px",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.tag}
                style={{
                  background: "var(--void)",
                  padding: "40px 36px",
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
            ))}
          </div>
        </section>

        <hr className="void-divider" />

        {/* ─── Preços ─── */}
        <section
          id="precos"
          className="void-section"
          style={{ paddingTop: 120, paddingBottom: 120 }}
        >
          <p className="t-label" style={{ color: "var(--amber)", marginBottom: 20 }}>
            Preço
          </p>
          <h2 className="t-heading-lg" style={{ marginBottom: 16 }}>
            Simples.
          </h2>
          <p className="t-body" style={{ color: "var(--ash)", marginBottom: 80 }}>
            Um número de gerações por mês. Sem crédito misterioso.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1px",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            {/* Grátis */}
            <PricingCard
              tier="GRÁTIS"
              price="R$ 0"
              highlight={false}
              items={[
                `${PLAN_CREATOR_LIMIT} vídeo de IA por mês`,
                "Publicação direta no Instagram",
                "Sem cartão de crédito",
              ]}
              cta={{ label: "Começar grátis", href: "/studio" }}
            />

            {/* Avulso */}
            <PricingCard
              tier="AVULSO"
              price={PLAN_AVULSO_PRICE}
              priceSuffix="/vídeo"
              highlight={false}
              items={[
                "1 vídeo extra, sem assinatura",
                "Usa quando o grátis acabar",
                "PIX ou cartão",
              ]}
              cta={{ label: "Comprar 1 vídeo", href: "/studio?buy=avulso" }}
            />

            {/* Pacote 5 */}
            <PricingCard
              tier="PACOTE 5"
              price={PLAN_PACOTE5_PRICE}
              priceSuffix="/pacote"
              highlight={false}
              items={[
                "5 vídeos de até 60 segundos",
                "Créditos não expiram no mês",
                "Compra única, sem assinatura",
              ]}
              cta={{ label: "Comprar pacote", href: "/studio?buy=pacote5" }}
            />

            {/* PRO — destaque */}
            <PricingCard
              tier="PRO"
              price={PLAN_PRO_PRICE}
              priceSuffix="/mês"
              highlight={true}
              badge="Mais escolhido"
              items={[
                `${PLAN_PRO_LIMIT} gerações de IA por mês`,
                "Publicação direta no Instagram",
                "Cancele quando quiser",
              ]}
              cta={{ label: "Assinar Pro", href: "/studio" }}
            />

            {/* Enterprise */}
            <div style={{ background: "var(--void)", padding: "40px 36px" }}>
              <p className="t-label" style={{ color: "var(--verdant)", marginBottom: 20 }}>
                AGÊNCIA / EMPRESA
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
                {["Volume alto de gerações", "Múltiplas marcas/contas", "Suporte dedicado"].map((item) => (
                  <li key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Check size={14} color="var(--verdant)" />
                    <span style={{ color: "var(--ash)", fontSize: 15 }}>{item}</span>
                  </li>
                ))}
              </ul>
              <a href={SALES_EMAIL} className="t-nav" style={{ color: "var(--verdant)", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={14} />
                Falar com o time
              </a>
            </div>
          </div>
        </section>

        <hr className="void-divider" />

        {/* ─── FAQ ─── */}
        <section
          id="faq"
          className="void-section"
          style={{ paddingTop: 120, paddingBottom: 120, maxWidth: 800 }}
        >
          <p className="t-label" style={{ color: "var(--amber)", marginBottom: 20 }}>
            FAQ
          </p>
          <h2 className="t-heading" style={{ marginBottom: 60 }}>
            Perguntas frequentes.
          </h2>
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
          <div className="void-faq">
            <FaqAccordion items={FAQ} />
          </div>
        </section>

        <hr className="void-divider" />

        {/* ─── CTA Final ─── */}
        <section
          className="void-section"
          style={{ paddingTop: 120, paddingBottom: 140, textAlign: "left" }}
        >
          <p className="t-label" style={{ color: "var(--amber)", marginBottom: 24 }}>
            Comece agora
          </p>
          <h2 className="t-heading-lg" style={{ maxWidth: 640, marginBottom: 48 }}>
            Seu próximo anúncio pode estar pronto em{" "}
            <span style={{ color: "var(--iris)" }}>3 minutos.</span>
          </h2>
          <Link href="/studio" className="btn-iris" style={{ fontSize: 15, padding: "16px 32px" }}>
            Criar meu primeiro anúncio grátis
            <ArrowRight size={18} />
          </Link>
        </section>

        {/* ─── Footer ─── */}
        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div
            className="void-section"
            style={{ paddingTop: 60, paddingBottom: 60 }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 40,
                marginBottom: 48,
              }}
            >
              <div>
                <p className="t-nav" style={{ color: "var(--bone)", marginBottom: 12 }}>
                  LUCROM<span style={{ color: "var(--iris)" }}>.</span>
                </p>
                <p style={{ color: "var(--ash)", fontSize: 13, lineHeight: 1.6 }}>
                  Marketing inteligente para o MEI brasileiro.
                </p>
              </div>

              <div>
                <p className="t-label" style={{ color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>
                  Produto
                </p>
                <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { href: "#pipeline", label: "Como funciona" },
                    { href: "#precos", label: "Preços" },
                    { href: "/studio", label: "Entrar" },
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
            </div>

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
                © {new Date().getFullYear()} Lucrom Studio
              </p>
              <p className="t-label" style={{ color: "rgba(255,255,255,0.2)" }}>
                Feito para o MEI brasileiro
              </p>
            </div>
          </div>
        </footer>
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