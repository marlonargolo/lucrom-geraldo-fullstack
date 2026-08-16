"use client"

// Aba "Peças" — fecha o fluxo do Módulo Ajuste Rápido Humano de ponta a
// ponta: gerar (IA, GraphicComposerService.compose) → QuickAdjustPanel
// (determinístico, sem IA). Mesmo padrão de real-pipeline-panel.tsx: chama
// o backend de verdade, brand kit vem de brandClient (real, do tenant).

import { useEffect, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { brandClient, type BrandKit } from "@/lib/production/brand-client"
import { graphicComposerClient, type GraphicComposition } from "@/lib/production/graphic-composer-client"
import { QuickAdjustPanel } from "./quick-adjust-panel"

export function GraphicsLab() {
  const [brands, setBrands] = useState<BrandKit[] | null>(null)
  const [selectedBrand, setSelectedBrand] = useState("")
  const [kind, setKind] = useState<"static_art" | "carousel">("static_art")
  const [format, setFormat] = useState<"1080x1350" | "1080x1920">("1080x1350")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [footer, setFooter] = useState("")
  const [composing, setComposing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [composition, setComposition] = useState<GraphicComposition | null>(null)

  useEffect(() => {
    brandClient
      .list()
      .then((list) => {
        setBrands(list)
        if (list[0]) setSelectedBrand(list[0].id)
      })
      .catch(() => setBrands([]))
  }, [])

  const brand = brands?.find((b) => b.id === selectedBrand) ?? null

  const create = async () => {
    if (!brand) {
      setError("Selecione (ou crie) uma marca antes de gerar a peça.")
      return
    }
    if (!title.trim()) {
      setError("O título não pode ficar em branco.")
      return
    }
    setError(null)
    setComposing(true)
    try {
      const result = await graphicComposerClient.compose({
        kind,
        format,
        slides: [{ title, body, footer }],
        brand_kit: {
          palette: brand.palette,
          font_family: brand.font_family ?? undefined,
          logo_url: brand.logo_url ?? undefined,
        },
      })
      setComposition(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao compor a peça.")
    } finally {
      setComposing(false)
    }
  }

  if (composition) {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setComposition(null)}
          className="self-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Gerar outra peça
        </button>
        <QuickAdjustPanel compositionId={composition.id} />
      </div>
    )
  }

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="font-display text-sm font-bold">Gerar peça gráfica</h2>
      </div>
      <p className="mb-4 text-[11px] leading-relaxed text-muted-foreground">
        A IA compõe a arte inicial (título, texto, chamada e marca). Depois de pronta, você ajusta fonte, cor,
        tamanho e posição sem gerar de novo — ver Ajuste Rápido.
      </p>

      <div className="flex flex-col gap-3">
        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Marca</span>
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
          >
            {(brands ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {brands && brands.length === 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Nenhuma marca cadastrada ainda — crie uma na aba Pipeline real antes de gerar peças.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tipo</span>
            <div className="grid grid-cols-2 gap-2">
              {(["static_art", "carousel"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
                    kind === k ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground",
                  )}
                >
                  {k === "static_art" ? "Arte única" : "Carrossel"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Formato</span>
            <div className="grid grid-cols-2 gap-2">
              {(["1080x1350", "1080x1920"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
                    format === f ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground",
                  )}
                >
                  {f === "1080x1350" ? "Feed" : "Story"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Texto de apoio"
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
        />
        <input
          value={footer}
          onChange={(e) => setFooter(e.target.value)}
          placeholder="Chamada (CTA)"
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
        />

        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

        <button
          type="button"
          disabled={composing}
          onClick={create}
          className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {composing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          Gerar peça
        </button>
      </div>
    </section>
  )
}
