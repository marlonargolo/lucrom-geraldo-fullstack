"use client"

// Cliente do módulo Ajuste Rápido Humano — edição determinística pós-geração
// de peças gráficas (carrossel/arte estática), sem nenhuma nova chamada de
// IA. Segue o contrato de
// `apps/api/src/creative/graphic-composer/graphic-composer.controller.ts`:
//   - GET  /api/v1/graphics/:id?tenantId=          → GraphicComposition
//   - PATCH /api/v1/graphics/:id/layers            → aplica ajustes, re-renderiza local, incrementa version
//   - POST /api/v1/graphics/:id/restore/:version?tenantId= → volta a uma versão do histórico (instantâneo)
//
// Mesmo padrão de tenant de lib/production/brand-client.ts: vem sempre da
// sessão (JWT), nunca de input livre do usuário.

import { apiFetch, DEFAULT_TENANT_ID } from "@/lib/api/client"
import { getSession } from "@/lib/auth/session-store"

export type LayerAlign = "left" | "center" | "right"
export type LayerVerticalPosition = "top" | "center" | "bottom"

export interface GraphicLayerStyle {
  color?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: number
  align?: LayerAlign
  verticalPosition?: LayerVerticalPosition
  opacity?: number
  spacingBottom?: number
  visible?: boolean
  assetUrl?: string
}

export type GraphicLayerKind = "background" | "image" | "logo" | "headline" | "subtitle" | "cta" | "decorative"

export interface GraphicLayer {
  id: string
  kind: GraphicLayerKind
  content?: string
  style: GraphicLayerStyle
}

export interface GraphicSlideLayers {
  slide_index: number
  elements: GraphicLayer[]
}

export interface GraphicCompositionSnapshot {
  version: number
  layers: GraphicSlideLayers[]
  output_asset_ids: string[]
  source: "human" | "ai"
  note?: string
  created_at: string
}

export interface GraphicComposition {
  id: string
  tenant_id: string
  kind: "carousel" | "static_art"
  format: "1080x1350" | "1080x1920"
  output_asset_ids: string[]
  status: "DONE" | "FAILED"
  layers: GraphicSlideLayers[] | null
  version: number
  history: GraphicCompositionSnapshot[]
  created_at: string
  updated_at: string
}

export interface LayerUpdate {
  slide_index: number
  layer_id: string
  content?: string
  style?: GraphicLayerStyle
}

function currentTenantId(): string {
  const session = getSession()
  const tenantId = session?.tenantId ?? DEFAULT_TENANT_ID
  if (!tenantId) {
    throw new Error("Não foi possível determinar o tenant (faça login novamente).")
  }
  return tenantId
}

export interface BrandKitInput {
  palette: string[]
  font_family?: string
  logo_url?: string
}

export interface ComposeGraphicInput {
  kind: "carousel" | "static_art"
  format: "1080x1350" | "1080x1920"
  slides: { title?: string; body?: string; footer?: string }[]
  brand_kit: BrandKitInput
}

export const graphicComposerClient = {
  compose: (input: ComposeGraphicInput): Promise<GraphicComposition> => {
    const tenantId = currentTenantId()
    return apiFetch<GraphicComposition>(`/api/v1/graphics/compose`, {
      method: "POST",
      body: JSON.stringify({ tenant_id: tenantId, ...input }),
    })
  },

  get: (id: string): Promise<GraphicComposition> => {
    const tenantId = currentTenantId()
    return apiFetch<GraphicComposition>(`/api/v1/graphics/${id}?tenantId=${encodeURIComponent(tenantId)}`)
  },

  /** Aplica ajustes determinísticos (fonte/cor/posição/opacidade/troca de ativo/visibilidade/texto). Nunca chama IA. */
  updateLayers: (id: string, updates: LayerUpdate[], note?: string): Promise<GraphicComposition> => {
    const tenantId = currentTenantId()
    return apiFetch<GraphicComposition>(`/api/v1/graphics/${id}/layers`, {
      method: "PATCH",
      body: JSON.stringify({ tenant_id: tenantId, updates, note }),
    })
  },

  /** Restauração instantânea (não re-renderiza — reaproveita os assets já gerados daquela versão). */
  restoreVersion: (id: string, version: number): Promise<GraphicComposition> => {
    const tenantId = currentTenantId()
    return apiFetch<GraphicComposition>(
      `/api/v1/graphics/${id}/restore/${version}?tenantId=${encodeURIComponent(tenantId)}`,
      { method: "POST" },
    )
  },

  /** Resolve um `media_assets.id` (ex.: um item de `output_asset_ids`) pra uma URL exibível. */
  resolveAssetUrl: (assetId: string): Promise<string> => {
    const tenantId = currentTenantId()
    return apiFetch<{ download_url: string }>(
      `/api/v1/media-assets/${assetId}?tenantId=${encodeURIComponent(tenantId)}`,
    ).then((r) => r.download_url)
  },
}
