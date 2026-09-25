"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, FileText, ImagePlus, Loader2, Trash2, Upload, Video, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { isApiConfigured } from "@/lib/api/client"
import { getSession } from "@/lib/auth/session-store"
import { mediaUploadClient } from "@/lib/media/media-upload-client"
import { graphicComposerClient } from "@/lib/production/graphic-composer-client"

export type ReferenceKind = "image" | "video" | "document"
export type ReferenceStatus = "uploading" | "ready" | "error"

export interface ReferenceAsset {
  localId: string
  name: string
  kind: ReferenceKind
  mimeType: string
  size: number
  previewUrl: string
  status: ReferenceStatus
  useAsReference: boolean
  remoteId?: string
  remoteUrl?: string
  error?: string
}

interface Props {
  onAssetsChange: (assets: ReferenceAsset[]) => void
  disabled?: boolean
  compact?: boolean
}

const ACCEPT = "image/*,video/*,.pdf,.doc,.docx,.txt,.rtf,.ppt,.pptx,.xls,.xlsx"
const MAX_FILE_SIZE = 100 * 1024 * 1024

function fileKind(file: File): ReferenceKind {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  return "document"
}

function iconFor(kind: ReferenceKind) {
  if (kind === "image") return ImagePlus
  if (kind === "video") return Video
  return FileText
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function ReferenceUploader({ onAssetsChange, disabled = false, compact = false }: Props) {
  const [assets, setAssets] = useState<ReferenceAsset[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const assetsRef = useRef<ReferenceAsset[]>([])

  useEffect(() => {
    assetsRef.current = assets
    onAssetsChange(assets)
  }, [assets, onAssetsChange])

  useEffect(() => {
    return () => assetsRef.current.forEach((asset) => URL.revokeObjectURL(asset.previewUrl))
  }, [])

  const selectedCount = assets.filter((asset) => asset.useAsReference && asset.status !== "error").length
  const kindCounts = useMemo(
    () => ({
      image: assets.filter((asset) => asset.kind === "image").length,
      video: assets.filter((asset) => asset.kind === "video").length,
      document: assets.filter((asset) => asset.kind === "document").length,
    }),
    [assets],
  )

  const updateAsset = (localId: string, patch: Partial<ReferenceAsset>) => {
    setAssets((current) => current.map((asset) => (asset.localId === localId ? { ...asset, ...patch } : asset)))
  }

  const uploadReference = async (asset: ReferenceAsset, file: File) => {
    const session = getSession()
    if (!isApiConfigured() || !session) {
      updateAsset(asset.localId, { status: "ready" })
      return
    }

    try {
      const uploaded = await mediaUploadClient.upload(file)
      let remoteUrl: string | undefined
      try {
        remoteUrl = await graphicComposerClient.resolveAssetUrl(uploaded.id)
      } catch {
        // A reference can still be sent by asset id when the download URL is private.
      }
      updateAsset(asset.localId, { status: "ready", remoteId: uploaded.id, remoteUrl })
    } catch (error) {
      // O API server ativo ainda não expõe o endpoint legado de media-assets.
      // Mantemos a referência local para que a criação continue funcional;
      // quando o endpoint voltar, o mesmo componente passa a enviar o arquivo.
      const status = typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: unknown }).status
        : undefined
      if (status === 404 || status === 405) {
        updateAsset(asset.localId, { status: "ready", error: undefined })
        return
      }
      updateAsset(asset.localId, {
        status: "error",
        error: error instanceof Error ? error.message : "Não foi possível enviar este arquivo.",
      })
    }
  }

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || disabled) return
    setValidationError(null)
    const files = Array.from(fileList)
    const validFiles: Array<{ file: File; asset: ReferenceAsset }> = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setValidationError(`"${file.name}" ultrapassa o limite de 100 MB.`)
        continue
      }
      const asset: ReferenceAsset = {
        localId: makeId(),
        name: file.name,
        kind: fileKind(file),
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        status: "uploading",
        useAsReference: true,
      }
      validFiles.push({ file, asset })
    }

    if (validFiles.length === 0) return
    setAssets((current) => [...current, ...validFiles.map(({ asset }) => asset)])
    validFiles.forEach(({ file, asset }) => void uploadReference(asset, file))
    if (inputRef.current) inputRef.current.value = ""
  }

  const removeAsset = (localId: string) => {
    setAssets((current) => {
      const asset = current.find((item) => item.localId === localId)
      if (asset) URL.revokeObjectURL(asset.previewUrl)
      return current.filter((item) => item.localId !== localId)
    })
  }

  const toggleKind = (kind: ReferenceKind) => {
    setAssets((current) =>
      current.map((asset) =>
        asset.kind === kind && asset.status !== "error"
          ? { ...asset, useAsReference: !current.some((item) => item.kind === kind && item.useAsReference) }
          : asset,
      ),
    )
  }

  return (
    <div className={cn("rounded-xl border border-border bg-secondary/25", compact ? "p-3" : "p-4")}>
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Upload className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-foreground">Referências da produção</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Envie imagens, vídeos e documentos para orientar a próxima peça.
          </p>
        </div>
        <label
          className={cn(
            "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <ImagePlus className="h-3.5 w-3.5" aria-hidden />
          Adicionar arquivos
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            disabled={disabled}
            onChange={(event) => addFiles(event.target.files)}
          />
        </label>
      </div>

      {assets.length > 0 && (
        <>
          <div className="mt-3 flex flex-col gap-1.5">
            {assets.map((asset) => {
              const Icon = iconFor(asset.kind)
              return (
                <div key={asset.localId} className="flex items-center gap-2 rounded-lg border border-border bg-background/65 px-2.5 py-2">
                  {asset.kind === "image" ? (
                    <img src={asset.previewUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
                  ) : asset.kind === "video" ? (
                    <video src={asset.previewUrl} muted className="h-8 w-8 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-foreground">{asset.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {asset.status === "uploading"
                        ? "Enviando..."
                        : asset.status === "error"
                          ? asset.error ?? "Falha no envio"
                          : `${formatSize(asset.size)} · ${asset.remoteId ? "enviado" : "pronto localmente"}`}
                    </p>
                  </div>
                  {asset.status === "uploading" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-label="Enviando" />
                  ) : asset.status === "ready" ? (
                    <Check className="h-3.5 w-3.5 text-success" aria-label="Pronto" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-destructive" aria-label="Erro no envio" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeAsset(asset.localId)}
                    disabled={disabled}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    aria-label={`Remover ${asset.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
            <p className="text-[11px] font-semibold text-foreground">Usar na próxima produção?</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Escolha quais matrizes a dinâmica deve considerar. {selectedCount} selecionada(s).
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {([
                ["image", "Imagens", ImagePlus],
                ["video", "Vídeos", Video],
                ["document", "Documentos", FileText],
              ] as const).map(([kind, label, Icon]) => {
                const active = assets.some((asset) => asset.kind === kind && asset.useAsReference && asset.status !== "error")
                const count = kindCounts[kind]
                return (
                  <button
                    key={kind}
                    type="button"
                    disabled={disabled || count === 0}
                    onClick={() => toggleKind(kind)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      active ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground",
                    )}
                    aria-pressed={active}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    {label} {count > 0 ? `(${count})` : ""}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {validationError && <p className="mt-2 text-[10px] text-destructive">{validationError}</p>}
      {!isApiConfigured() && assets.length > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Modo de teste: os arquivos estão prontos localmente para esta produção. Com a API conectada, eles também serão enviados ao workspace.
        </p>
      )}
    </div>
  )
}