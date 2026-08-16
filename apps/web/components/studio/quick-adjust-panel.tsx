"use client"

// Módulo Arquitetural — Ajuste Rápido Humano.
//
// Depois que uma peça gráfica é gerada (GraphicComposerService.compose,
// backend), este painel permite ajustar fonte, tamanho, cor, posição,
// opacidade, visibilidade e troca de ativo SEM chamar a IA de novo — cada
// "Salvar" aqui é um PATCH /api/v1/graphics/:id/layers, que só re-renderiza
// via Puppeteer no backend (determinístico, sem custo de inferência).
//
// Fluxo (ver módulo do doc, seção 3):
//   IA produz → peça pronta → AJUSTE RÁPIDO → pré-visualizar → salvar →
//   Quality Gate → exportar.
//
// A pré-visualização é aproximada em CSS no navegador (instantânea, sem ida
// ao servidor) enquanto o usuário mexe nos controles; "Salvar" é que gera de
// fato o PNG final (mesmo motor de composição de compose()) e avança a
// versão. Isso evita duas implementações divergentes do layout — o HTML/CSS
// real de verdade é sempre o do backend (slide-template.ts).

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Eye,
  EyeOff,
  GitBranch,
  Image as ImageIcon,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
  Type,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  graphicComposerClient,
  type GraphicComposition,
  type GraphicLayer,
  type GraphicLayerStyle,
  type LayerAlign,
  type LayerVerticalPosition,
  type LayerUpdate,
} from "@/lib/production/graphic-composer-client"

const EDITABLE_TEXT_KINDS = ["headline", "subtitle", "cta"] as const
type EditableTextKind = (typeof EDITABLE_TEXT_KINDS)[number]

const TEXT_KIND_LABEL: Record<EditableTextKind, string> = {
  headline: "Título",
  subtitle: "Texto",
  cta: "Chamada (CTA)",
}

const FONT_OPTIONS = [
  { label: "Padrão da marca", value: "" },
  { label: "Helvetica", value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { label: "Georgia (serifada)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Courier (mono)", value: "'Courier New', monospace" },
]

interface Props {
  compositionId: string
  /** Disparado quando o Quality Gate deve reavaliar a peça (nova versão salva). */
  onSaved?: (composition: GraphicComposition) => void
}

export function QuickAdjustPanel({ compositionId, onSaved }: Props) {
  const [composition, setComposition] = useState<GraphicComposition | null>(null)
  const [slideIndex, setSlideIndex] = useState(0)
  const [activeLayerId, setActiveLayerId] = useState<string>("headline")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pendingBySlide, setPendingBySlide] = useState<Record<number, Record<string, GraphicLayer>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    graphicComposerClient
      .get(compositionId)
      .then(async (c) => {
        if (cancelled) return
        setComposition(c)
        const assetId = c.output_asset_ids[0]
        if (assetId) setPreviewUrl(await graphicComposerClient.resolveAssetUrl(assetId))
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Falha ao carregar a peça."))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [compositionId])

  const slideLayers = composition?.layers?.find((s) => s.slide_index === slideIndex)?.elements ?? []
  const pendingForSlide = pendingBySlide[slideIndex] ?? {}

  /** Camada mesclada (salva + edição pendente ainda não enviada) — é o que os controles e a pré-visualização leem. */
  const mergedLayers: GraphicLayer[] = useMemo(
    () => slideLayers.map((l) => pendingForSlide[l.id] ?? l),
    [slideLayers, pendingForSlide],
  )

  const activeLayer = mergedLayers.find((l) => l.id === activeLayerId)
  const dirty = Object.keys(pendingForSlide).length > 0

  const patchLayer = (layerId: string, patch: Partial<Pick<GraphicLayer, "content">> & { style?: GraphicLayerStyle }) => {
    const base = mergedLayers.find((l) => l.id === layerId)
    if (!base) return
    const next: GraphicLayer = {
      ...base,
      content: patch.content ?? base.content,
      style: { ...base.style, ...patch.style },
    }
    setPendingBySlide((prev) => ({
      ...prev,
      [slideIndex]: { ...(prev[slideIndex] ?? {}), [layerId]: next },
    }))
  }

  const discard = () => {
    setPendingBySlide((prev) => {
      const next = { ...prev }
      delete next[slideIndex]
      return next
    })
  }

  const save = async () => {
    if (!composition || !dirty) return
    setSaving(true)
    setError(null)
    try {
      const updates: LayerUpdate[] = Object.values(pendingForSlide).map((l) => ({
        slide_index: slideIndex,
        layer_id: l.id,
        content: l.content,
        style: l.style,
      }))
      const updated = await graphicComposerClient.updateLayers(composition.id, updates, "Ajuste rápido")
      setComposition(updated)
      discard()
      const assetId = updated.output_asset_ids[slideIndex] ?? updated.output_asset_ids[0]
      if (assetId) setPreviewUrl(await graphicComposerClient.resolveAssetUrl(assetId))
      onSaved?.(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar o ajuste.")
    } finally {
      setSaving(false)
    }
  }

  const restore = async (version: number) => {
    if (!composition) return
    setSaving(true)
    setError(null)
    try {
      const updated = await graphicComposerClient.restoreVersion(composition.id, version)
      setComposition(updated)
      setPendingBySlide({})
      const assetId = updated.output_asset_ids[slideIndex] ?? updated.output_asset_ids[0]
      if (assetId) setPreviewUrl(await graphicComposerClient.resolveAssetUrl(assetId))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao restaurar a versão.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando peça...
      </div>
    )
  }

  if (!composition) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        {error ?? "Peça não encontrada."}
      </div>
    )
  }

  if (!composition.layers || composition.layers.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Esta peça foi gerada antes do módulo Ajuste Rápido e não tem camadas editáveis. Gere uma nova peça pra poder
        ajustá-la sem IA.
      </div>
    )
  }

  const [w, h] = composition.format.split("x").map(Number)
  const aspect = w / h

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Pré-visualização */}
      <div className="flex flex-col gap-3 lg:col-span-6">
        {composition.kind === "carousel" && composition.output_asset_ids.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {composition.output_asset_ids.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={async () => {
                  setSlideIndex(idx)
                  const assetId = composition.output_asset_ids[idx]
                  if (assetId) setPreviewUrl(await graphicComposerClient.resolveAssetUrl(assetId))
                }}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  idx === slideIndex
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                Slide {idx + 1}
              </button>
            ))}
          </div>
        )}

        <div
          className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-black"
          style={{ aspectRatio: aspect }}
        >
          {dirty ? (
            <LivePreview layers={mergedLayers} width={w} height={h} />
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Peça atual" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem prévia</div>
          )}
          <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">
            {dirty ? "prévia (não salvo)" : `v${composition.version}`}
          </span>
        </div>

        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={discard}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Descartar
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Save className="h-3.5 w-3.5" aria-hidden />}
            Salvar ajuste
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <GitBranch className="h-3.5 w-3.5" aria-hidden />
            Histórico ({composition.history.length})
          </button>
        </div>

        {historyOpen && (
          <ul className="flex flex-col gap-1.5 rounded-xl border border-border bg-background/60 p-2.5">
            <li className="flex items-center gap-2 text-[11px]">
              <span className="w-8 shrink-0 font-mono text-primary">v{composition.version}</span>
              <span className="text-foreground/80">atual</span>
            </li>
            {composition.history.map((h) => (
              <li key={h.version} className="flex items-center gap-2 text-[11px]">
                <span className="w-8 shrink-0 font-mono text-muted-foreground">v{h.version}</span>
                <span className="truncate text-muted-foreground">{h.note || "ajuste sem nota"}</span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => restore(h.version)}
                  className="ml-auto shrink-0 rounded-md border border-border px-2 py-0.5 font-medium text-foreground/80 transition-colors hover:text-foreground disabled:opacity-40"
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ajuste Rápido */}
      <div className="flex flex-col gap-4 lg:col-span-6">
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="font-display text-sm font-bold">Ajuste rápido</h2>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">sem IA</span>
          </div>

          {/* seletor de camada */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {mergedLayers
              .filter((l) => l.kind !== "background")
              .map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setActiveLayerId(l.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                    activeLayerId === l.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l.kind === "logo" ? "Logo" : TEXT_KIND_LABEL[l.kind as EditableTextKind] ?? l.kind}
                </button>
              ))}
            <button
              type="button"
              onClick={() => setActiveLayerId("background")}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                activeLayerId === "background"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Fundo
            </button>
          </div>

          {activeLayerId === "background" ? (
            <BackgroundControls
              layer={mergedLayers.find((l) => l.kind === "background")}
              onChange={(style) => patchLayer("background", { style })}
            />
          ) : activeLayer?.kind === "logo" ? (
            <LogoControls layer={activeLayer} onChange={(style) => patchLayer(activeLayer.id, { style })} />
          ) : activeLayer ? (
            <TextLayerControls
              layer={activeLayer}
              onChangeContent={(content) => patchLayer(activeLayer.id, { content })}
              onChangeStyle={(style) => patchLayer(activeLayer.id, { style })}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma camada selecionada.</p>
          )}
        </section>

        <p className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Alterações aqui (fonte, tamanho, cor, posição, opacidade, troca de imagem, visibilidade) nunca chamam a IA —
          são aplicadas direto pelo motor de composição. Peça uma nova geração só se precisar de um conceito
          diferente.
        </p>
      </div>
    </div>
  )
}

// ─── Controles por tipo de camada ─────────────────────────────────────────

function Slider({ label, value, min, max, step = 1, unit = "", onChange }: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="font-mono text-[11px] text-foreground">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  )
}

function AlignButtons({ value, onChange }: { value: LayerAlign; onChange: (v: LayerAlign) => void }) {
  const options: { v: LayerAlign; Icon: typeof AlignLeft }[] = [
    { v: "left", Icon: AlignLeft },
    { v: "center", Icon: AlignCenter },
    { v: "right", Icon: AlignRight },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(({ v, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cn(
            "flex items-center justify-center rounded-lg border px-2 py-1.5 transition-colors",
            value === v ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
    </div>
  )
}

function VerticalPositionButtons({ value, onChange }: { value: LayerVerticalPosition; onChange: (v: LayerVerticalPosition) => void }) {
  const labels: Record<LayerVerticalPosition, string> = { top: "Topo", center: "Centro", bottom: "Base" }
  return (
    <div className="grid grid-cols-3 gap-2">
      {(["top", "center", "bottom"] as LayerVerticalPosition[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cn(
            "rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
            value === v ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  )
}

function TextLayerControls({
  layer,
  onChangeContent,
  onChangeStyle,
}: {
  layer: GraphicLayer
  onChangeContent: (content: string) => void
  onChangeStyle: (style: GraphicLayerStyle) => void
}) {
  const visible = layer.style.visible !== false
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <Type className="h-3 w-3" aria-hidden />
          Texto
        </div>
        <textarea
          value={layer.content ?? ""}
          onChange={(e) => onChangeContent(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
        />
      </div>

      <div>
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Fonte</span>
        <select
          value={layer.style.fontFamily ?? ""}
          onChange={(e) => onChangeStyle({ fontFamily: e.target.value || undefined })}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <Slider
        label="Tamanho"
        value={layer.style.fontSize ?? 48}
        min={12}
        max={160}
        unit="px"
        onChange={(fontSize) => onChangeStyle({ fontSize })}
      />

      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <Palette className="h-3 w-3" aria-hidden />
          Cor
        </div>
        <input
          type="color"
          value={layer.style.color ?? "#FFFFFF"}
          onChange={(e) => onChangeStyle({ color: e.target.value })}
          className="h-9 w-full cursor-pointer rounded-lg border border-border bg-secondary"
        />
      </div>

      <div>
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Alinhamento</span>
        <AlignButtons value={layer.style.align ?? "left"} onChange={(align) => onChangeStyle({ align })} />
      </div>

      {layer.kind === "headline" && (
        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Posição vertical</span>
          <VerticalPositionButtons
            value={layer.style.verticalPosition ?? "center"}
            onChange={(verticalPosition) => onChangeStyle({ verticalPosition })}
          />
        </div>
      )}

      <Slider
        label="Intensidade"
        value={Math.round((layer.style.opacity ?? 1) * 100)}
        min={10}
        max={100}
        unit="%"
        onChange={(v) => onChangeStyle({ opacity: v / 100 })}
      />

      <button
        type="button"
        onClick={() => onChangeStyle({ visible: !visible })}
        className="inline-flex items-center gap-2 self-start rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <Eye className="h-3.5 w-3.5" aria-hidden /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}
        {visible ? "Visível" : "Oculto"}
      </button>
    </div>
  )
}

function LogoControls({ layer, onChange }: { layer: GraphicLayer; onChange: (style: GraphicLayerStyle) => void }) {
  const visible = layer.style.visible !== false
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => onChange({ visible: !visible })}
        className="inline-flex items-center gap-2 self-start rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <Eye className="h-3.5 w-3.5" aria-hidden /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}
        {visible ? "Logo visível" : "Logo oculto"}
      </button>

      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <ImageIcon className="h-3 w-3" aria-hidden />
          Trocar logo (URL de um ativo já enviado)
        </div>
        <input
          type="url"
          placeholder="https://..."
          defaultValue={layer.style.assetUrl ?? ""}
          onBlur={(e) => e.target.value && onChange({ assetUrl: e.target.value })}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
        />
      </div>

      <Slider
        label="Intensidade"
        value={Math.round((layer.style.opacity ?? 1) * 100)}
        min={10}
        max={100}
        unit="%"
        onChange={(v) => onChange({ opacity: v / 100 })}
      />
    </div>
  )
}

function BackgroundControls({ layer, onChange }: { layer?: GraphicLayer; onChange: (style: GraphicLayerStyle) => void }) {
  if (!layer) return <p className="text-xs text-muted-foreground">Sem camada de fundo nesta peça.</p>
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <Palette className="h-3 w-3" aria-hidden />
          Cor de fundo
        </div>
        <input
          type="color"
          value={layer.style.color ?? "#111111"}
          onChange={(e) => onChange({ color: e.target.value, assetUrl: undefined })}
          className="h-9 w-full cursor-pointer rounded-lg border border-border bg-secondary"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <ImageIcon className="h-3 w-3" aria-hidden />
          Trocar fundo por imagem (URL de um ativo já enviado)
        </div>
        <input
          type="url"
          placeholder="https://..."
          defaultValue={layer.style.assetUrl ?? ""}
          onBlur={(e) => e.target.value && onChange({ assetUrl: e.target.value })}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
        />
      </div>
    </div>
  )
}

// ─── Pré-visualização local (aproximada) ──────────────────────────────────
//
// Reproduz em CSS a mesma hierarquia de `renderSlideFromLayers`
// (slide-template.ts) o suficiente pra o usuário ver o efeito do ajuste na
// hora, sem ida ao servidor. O PNG final "de verdade" só existe depois de
// "Salvar" — esta prévia é deliberadamente aproximada (ex.: não aplica
// exatamente as mesmas quebras de linha do Chromium), nunca é o artefato
// exportado.

function LivePreview({ layers, width, height }: { layers: GraphicLayer[]; width: number; height: number }) {
  const bg = layers.find((l) => l.kind === "background")
  const headline = layers.find((l) => l.kind === "headline")
  const subtitle = layers.find((l) => l.kind === "subtitle")
  const cta = layers.find((l) => l.kind === "cta")
  const logo = layers.find((l) => l.kind === "logo")

  const background = bg?.style.assetUrl
    ? `center/cover no-repeat url(${bg.style.assetUrl})`
    : (bg?.style.color ?? "#111111")

  const vAlign = (v?: LayerVerticalPosition) => (v === "top" ? "flex-start" : v === "bottom" ? "flex-end" : "center")

  const textStyle = (l: GraphicLayer | undefined, defaultRatio: number, weight: number): React.CSSProperties | null => {
    if (!l || l.style.visible === false || !l.content) return null
    return {
      fontSize: l.style.fontSize ?? Math.round(width * defaultRatio),
      fontWeight: weight,
      color: l.style.color ?? "#FFFFFF",
      opacity: l.style.opacity ?? 1,
      textAlign: (l.style.align ?? "left") as React.CSSProperties["textAlign"],
      fontFamily: l.style.fontFamily || undefined,
      marginBottom: l.style.spacingBottom ?? Math.round(width * 0.035),
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    }
  }

  const headlineStyle = textStyle(headline, 0.075, 800)
  const subtitleStyle = textStyle(subtitle, 0.038, 400)
  const ctaStyle = textStyle(cta, 0.028, 600)

  return (
    <div
      className="flex h-full w-full flex-col p-[9%]"
      style={{ background, justifyContent: vAlign(headline?.style.verticalPosition), transform: "scale(1)" }}
    >
      {logo && logo.style.visible !== false && logo.style.assetUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo.style.assetUrl}
          alt="Logo"
          className="absolute right-[9%] top-[5%] max-h-[18%] max-w-[18%] object-contain"
          style={{ opacity: logo.style.opacity ?? 1 }}
        />
      )}
      {headlineStyle && <div style={headlineStyle}>{headline!.content}</div>}
      {subtitleStyle && <div style={subtitleStyle}>{subtitle!.content}</div>}
      {ctaStyle && (
        <div className="absolute bottom-[6%] left-[9%] uppercase tracking-wide" style={ctaStyle}>
          {cta!.content}
        </div>
      )}
    </div>
  )
}
