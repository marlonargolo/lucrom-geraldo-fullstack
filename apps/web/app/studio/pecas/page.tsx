"use client"

import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { GraphicsLab } from "@/components/studio/graphics-lab"

const FORMAT_CARDS = [
  { label: "Reel",    ratio: "9:16",  desc: "Instagram / TikTok" },
  { label: "Feed",    ratio: "1:1",   desc: "Instagram Feed" },
  { label: "YouTube", ratio: "16:9",  desc: "YouTube / LinkedIn" },
  { label: "Stories", ratio: "9:16",  desc: "Stories / Shorts" },
]

function FormatIcon({ ratio }: { ratio: string }) {
  const isVertical = ratio === "9:16"
  const isSquare = ratio === "1:1"
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect
        x={isVertical ? 13 : isSquare ? 8 : 4}
        y={isVertical ? 4 : isSquare ? 8 : 13}
        width={isVertical ? 14 : isSquare ? 24 : 32}
        height={isVertical ? 32 : isSquare ? 24 : 14}
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        className="text-primary"
      />
      <rect
        x={isVertical ? 16 : isSquare ? 11 : 7}
        y={isVertical ? 7 : isSquare ? 11 : 16}
        width={isVertical ? 8 : isSquare ? 18 : 26}
        height={isVertical ? 7 : isSquare ? 7 : 8}
        rx="1"
        fill="currentColor"
        className="text-primary/30"
      />
    </svg>
  )
}

export default function PecasPage() {
  const [selected, setSelected] = useState<string | null>(null)

  if (selected) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mb-4 flex items-center gap-1.5 text-[12px] text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao laboratório
        </button>
        <div className="min-h-0 flex-1 overflow-auto">
          <GraphicsLab />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <h1 className="mb-6 text-lg font-bold text-foreground">Laboratório de Peças</h1>
      <div className="grid grid-cols-4 gap-4">
        {FORMAT_CARDS.map(({ label, ratio, desc }) => (
          <button
            key={label}
            type="button"
            onClick={() => setSelected(label)}
            className="group flex flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 active:scale-95"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 transition-all duration-200 group-hover:bg-primary/20 group-hover:scale-110">
              <FormatIcon ratio={ratio} />
            </div>
            <div>
              <p className="text-[16px] font-bold text-foreground">{label}</p>
              <p className="mt-1 text-[13px] font-semibold text-primary">{ratio}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
            </div>
            <span className="w-full rounded-xl bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground transition-all group-hover:brightness-110">
              Criar
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
