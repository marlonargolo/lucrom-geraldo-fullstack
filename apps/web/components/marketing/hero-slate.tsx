"use client"

import { useEffect, useState } from "react"

// Exemplos reais do mesmo formato que lib/ai/prompt-layer.ts gera de verdade
// (hook/body/cta) — não é copy de marketing inventada, é o produto de verdade.
const EXAMPLES = [
  {
    negocio: "Hamburgueria artesanal",
    hook: "Esse combo não vai durar até sexta.",
    oferta: "Smash duplo + batata + refri por R$ 25",
    chamada: "Chama no WhatsApp e garante o seu",
  },
  {
    negocio: "Salão de manicure",
    hook: "Sua unha nova está a 1 mensagem de distância.",
    oferta: "Unha em gel completa por R$ 60, primeira cliente",
    chamada: "Manda um Direct e marca seu horário",
  },
  {
    negocio: "Eletricista autônomo",
    hook: "Problema elétrico não espera o mês acabar.",
    oferta: "Visita técnica e orçamento sem custo",
    chamada: "Chama agora e resolve hoje",
  },
] as const

export function HeroSlate() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % EXAMPLES.length), 4200)
    return () => clearInterval(id)
  }, [])

  const ex = EXAMPLES[index]

  return (
    <div className="relative mx-auto w-full max-w-[280px] sm:max-w-[300px]">
      {/* moldura tipo tela de celular, 9:16 */}
      <div className="relative aspect-[9/16] overflow-hidden rounded-[28px] border border-border bg-gradient-to-b from-secondary/60 to-background shadow-2xl shadow-black/40">
        {/* etiqueta de claquete no topo */}
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 font-mono text-[9px] tracking-wide text-muted-foreground">
          <span>LUCROM · CENA {String(index + 1).padStart(2, "0")}</span>
          <span className="text-primary">REC ●</span>
        </div>

        <div className="flex h-full flex-col justify-end gap-2 p-4 pb-6">
          <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {ex.negocio}
          </p>

          <TimedLine timecode="00:00" label="GANCHO">
            {ex.hook}
          </TimedLine>
          <TimedLine timecode="00:03" label="OFERTA">
            {ex.oferta}
          </TimedLine>
          <TimedLine timecode="00:08" label="CHAMADA">
            {ex.chamada}
          </TimedLine>
        </div>
      </div>

      {/* indicadores de progresso das 3 cenas */}
      <div className="mt-3 flex justify-center gap-1.5">
        {EXAMPLES.map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all duration-500 ${
              i === index ? "w-6 bg-primary" : "w-1.5 bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function TimedLine({
  timecode,
  label,
  children,
}: {
  timecode: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div key={`${timecode}-${children}`} className="animate-in fade-in slide-in-from-bottom-1 duration-500">
      <div className="flex items-baseline gap-1.5 font-mono text-[8px] uppercase tracking-wider text-primary/80">
        <span>{timecode}</span>
        <span className="text-muted-foreground">{label}</span>
      </div>
      <p className="font-display text-[13px] font-semibold leading-snug text-foreground">{children}</p>
    </div>
  )
}
