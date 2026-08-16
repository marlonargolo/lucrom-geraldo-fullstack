"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import {
  Download,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Sparkles,
  Type,
  Upload,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { downloadBlob, extForMime, formatTime } from "@/lib/video/media-engine"
import {
  type AudioGraph,
  type EditorFilters,
  type TextPosition,
  buildFilterString,
  exportEditedVideo,
} from "@/lib/video/editor-export"

const DEFAULT_FILTERS: EditorFilters = { brightness: 1, contrast: 1, saturate: 1 }

export function VideoEditor() {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState("")
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)

  const [inPoint, setInPoint] = useState(0)
  const [outPoint, setOutPoint] = useState(0)

  const [filters, setFilters] = useState<EditorFilters>(DEFAULT_FILTERS)
  const [overlayText, setOverlayText] = useState("")
  const [overlayPos, setOverlayPos] = useState<TextPosition>("bottom")
  const [watermark, setWatermark] = useState(true)

  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultMime, setResultMime] = useState("video/webm")
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioCache = useRef<AudioGraph | null>(null)
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false })

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl)
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("video/")) {
      setError("Envie um arquivo de vídeo (mp4, webm, mov...).")
      return
    }
    setError(null)
    audioCache.current = null
    if (fileUrl) URL.revokeObjectURL(fileUrl)
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl)
      setResultUrl(null)
    }
    const url = URL.createObjectURL(file)
    setFileUrl(url)
    setFileName(file.name)
    setFilters(DEFAULT_FILTERS)
    setOverlayText("")
  }

  const onLoadedMeta = () => {
    const v = videoRef.current
    if (!v) return
    setDuration(v.duration)
    setInPoint(0)
    setOutPoint(v.duration)
    setCurrent(0)
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      if (v.currentTime < inPoint || v.currentTime >= outPoint) v.currentTime = inPoint
      v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  const onTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    setCurrent(v.currentTime)
    if (v.currentTime >= outPoint && !v.paused) {
      v.pause()
      setPlaying(false)
    }
  }

  const scrub = (t: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = t
    setCurrent(t)
  }

  const resetEdits = () => {
    setFilters(DEFAULT_FILTERS)
    setOverlayText("")
    setInPoint(0)
    setOutPoint(duration)
  }

  const runExport = async () => {
    const v = videoRef.current
    if (!v || exporting) return
    if (outPoint - inPoint < 0.2) {
      setError("O trecho selecionado é muito curto.")
      return
    }
    setError(null)
    setExporting(true)
    setProgress(0)
    setPlaying(false)
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl)
      setResultUrl(null)
    }
    cancelRef.current = { cancelled: false }

    try {
      const { blob, mimeType } = await exportEditedVideo({
        video: v,
        inPoint,
        outPoint,
        filters,
        overlay: { text: overlayText, position: overlayPos, watermark },
        audioCache,
        fps: 30,
        onProgress: setProgress,
        signal: cancelRef.current,
      })
      if (cancelRef.current.cancelled) return
      const url = URL.createObjectURL(blob)
      setResultUrl(url)
      setResultMime(mimeType || "video/webm")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao exportar o vídeo.")
    } finally {
      setExporting(false)
      setProgress(0)
    }
  }

  const download = () => {
    if (!resultUrl) return
    fetch(resultUrl)
      .then((r) => r.blob())
      .then((blob) => downloadBlob(blob, `lucrom-editado.${extForMime(resultMime)}`))
  }

  const filterString = buildFilterString(filters)
  const pct = (t: number) => (duration ? (t / duration) * 100 : 0)

  if (!fileUrl) {
    return (
      <UploadZone
        dragOver={dragOver}
        setDragOver={setDragOver}
        onFile={loadFile}
        error={error}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Player + timeline */}
      <div className="flex flex-col gap-4 lg:col-span-7">
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="truncate font-display text-sm font-bold" title={fileName}>
              {fileName}
            </h2>
            <button
              type="button"
              onClick={() => {
                if (fileUrl) URL.revokeObjectURL(fileUrl)
                setFileUrl(null)
                setFileName("")
              }}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Upload className="h-3 w-3" aria-hidden />
              Trocar
            </button>
          </div>

          {/* prévia com filtros ao vivo */}
          <div className="relative overflow-hidden rounded-xl border border-border bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              src={fileUrl}
              onLoadedMetadata={onLoadedMeta}
              onTimeUpdate={onTimeUpdate}
              playsInline
              className="mx-auto max-h-[420px] w-full object-contain"
              style={{ filter: filterString }}
            />
            {/* overlay de texto ao vivo */}
            {overlayText.trim() && (
              <div
                className={cn(
                  "pointer-events-none absolute inset-x-0 flex justify-center px-4",
                  overlayPos === "top" ? "top-[10%]" : overlayPos === "center" ? "top-1/2 -translate-y-1/2" : "bottom-[8%]",
                )}
              >
                <span className="rounded-lg bg-black/55 px-3 py-1.5 text-center font-display text-sm font-bold text-white sm:text-base">
                  {overlayText}
                </span>
              </div>
            )}
            {watermark && (
              <span className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-black/50 px-2 py-1 font-display text-[10px] font-bold text-primary">
                LUCROM Studio
              </span>
            )}
          </div>

          {/* controles */}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
              aria-label={playing ? "Pausar" : "Reproduzir"}
            >
              {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            </button>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatTime(current)} / {formatTime(duration)}
            </span>
          </div>

          {/* timeline com marcadores de corte */}
          <div className="mt-3">
            <div className="relative h-8">
              {/* trilha */}
              <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-secondary" />
              {/* seleção */}
              <div
                className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary/40"
                style={{ left: `${pct(inPoint)}%`, right: `${100 - pct(outPoint)}%` }}
              />
              {/* posição atual */}
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.05}
                value={current}
                onChange={(e) => scrub(Number(e.target.value))}
                className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent accent-primary"
                aria-label="Linha do tempo"
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setInPoint(Math.min(current, outPoint - 0.2))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <Scissors className="h-3 w-3" aria-hidden />
                Início · {formatTime(inPoint)}
              </button>
              <span className="font-mono text-[11px] text-muted-foreground">
                trecho {formatTime(outPoint - inPoint)}
              </span>
              <button
                type="button"
                onClick={() => setOutPoint(Math.max(current, inPoint + 0.2))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <Scissors className="h-3 w-3" aria-hidden />
                Fim · {formatTime(outPoint)}
              </button>
            </div>
          </div>
        </section>

        {/* Resultado exportado */}
        {resultUrl && (
          <section className="rounded-2xl border border-success/40 bg-success/5 p-4 sm:p-5">
            <h2 className="mb-3 font-display text-sm font-bold text-foreground">Vídeo exportado</h2>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={resultUrl} controls playsInline className="w-full rounded-xl border border-border" />
            <button
              type="button"
              onClick={download}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Download className="h-4 w-4" aria-hidden />
              Baixar vídeo editado
            </button>
          </section>
        )}
      </div>

      {/* Painel de ajustes */}
      <div className="flex flex-col gap-4 lg:col-span-5">
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="font-display text-sm font-bold">Cor e imagem</h2>
            <button
              type="button"
              onClick={resetEdits}
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Resetar
            </button>
          </div>

          <Slider
            label="Brilho"
            value={filters.brightness}
            min={0.4}
            max={1.6}
            onChange={(v) => setFilters((f) => ({ ...f, brightness: v }))}
          />
          <Slider
            label="Contraste"
            value={filters.contrast}
            min={0.4}
            max={1.8}
            onChange={(v) => setFilters((f) => ({ ...f, contrast: v }))}
          />
          <Slider
            label="Saturação"
            value={filters.saturate}
            min={0}
            max={2.2}
            onChange={(v) => setFilters((f) => ({ ...f, saturate: v }))}
          />
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="font-display text-sm font-bold">Texto e marca</h2>
          </div>

          <input
            value={overlayText}
            onChange={(e) => setOverlayText(e.target.value)}
            placeholder="Legenda / chamada sobre o vídeo"
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
          />
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["top", "center", "bottom"] as TextPosition[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setOverlayPos(p)}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-[11px] font-medium capitalize transition-colors",
                  overlayPos === p
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={overlayPos === p}
              >
                {p === "top" ? "Topo" : p === "center" ? "Centro" : "Base"}
              </button>
            ))}
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={watermark}
              onChange={(e) => setWatermark(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Aplicar marca d&apos;água LUCROM Studio
          </label>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          {error && (
            <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          {exporting && (
            <div className="mb-3">
              <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>exportando (tempo real)</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-150"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {exporting ? (
              <button
                type="button"
                onClick={() => {
                  cancelRef.current.cancelled = true
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
                Cancelar
              </button>
            ) : (
              <button
                type="button"
                onClick={runExport}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="h-4 w-4" aria-hidden />
                )}
                Exportar vídeo
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            A exportação reproduz o trecho selecionado em tempo real para gravar o arquivo final com áudio.
          </p>
        </section>
      </div>
    </div>
  )
}

function UploadZone({
  dragOver,
  setDragOver,
  onFile,
  error,
}: {
  dragOver: boolean
  setDragOver: (v: boolean) => void
  onFile: (f: File | undefined) => void
  error: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="mx-auto max-w-xl">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          onFile(e.dataTransfer.files?.[0])
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40",
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Upload className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <p className="font-display text-base font-bold text-foreground">Envie um vídeo para editar</p>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Arraste e solte aqui ou clique para selecionar. Corte, ajuste cor, adicione texto e exporte — tudo no seu navegador.
          </p>
        </div>
        <span className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          Selecionar vídeo
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
      {error && <p className="mt-3 text-center text-xs text-destructive">{error}</p>}
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="font-mono text-[11px] text-foreground">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  )
}
