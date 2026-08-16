"use client"

// Cliente de Brand Kits pro Director Engine real.
//
// Segue o contrato de `apps/api/src/brand/brand.controller.ts`:
//   - GET /brand/brand-kits exige `?tenant_id=` (BrandController.listBrandKits
//     usa @Query('tenant_id') obrigatório).
//   - A entidade `BrandKit` (brand-kit.entity.ts) tem os campos `id,
//     tenant_id, name, palette, font_family, logo_url, niche_preset_id`.
//   - `CreateBrandKitDto` exige `tenant_id`, `name`, `palette` e aceita
//     opcionalmente `font_family`, `logo_url`, `niche_preset_id`.
//
// O tenant_id vem do JWT da sessão ativa (mesmo padrão de
// lib/api/client.ts / DEFAULT_TENANT_ID), nunca digitado pelo usuário.

import { apiFetch, DEFAULT_TENANT_ID } from "@/lib/api/client"
import { getSession } from "@/lib/auth/session-store"

export interface BrandKit {
  id: string
  tenant_id: string
  name: string
  palette: string[]
  font_family: string | null
  logo_url: string | null
  niche_preset_id: string | null
}

/** Tenant do usuário logado (JWT) — cai pro DEFAULT_TENANT_ID só em fluxos legados sem sessão. */
function currentTenantId(): string {
  const session = getSession()
  const tenantId = session?.tenantId ?? DEFAULT_TENANT_ID
  if (!tenantId) {
    throw new Error("Não foi possível determinar o tenant (faça login novamente).")
  }
  return tenantId
}

export const brandClient = {
  list: (): Promise<BrandKit[]> => {
    const tenantId = currentTenantId()
    return apiFetch<BrandKit[]>(`/brand/brand-kits?tenant_id=${encodeURIComponent(tenantId)}`)
  },
  create: (name: string): Promise<BrandKit> => {
    const tenantId = currentTenantId()
    return apiFetch<BrandKit>("/brand/brand-kits", {
      method: "POST",
      body: JSON.stringify({
        tenant_id: tenantId,
        name,
        // Paleta mínima válida (ArrayMinSize(1) no DTO) — o usuário pode
        // editar depois num brand kit já salvo; aqui só destrava a criação
        // rápida a partir do painel do Director Engine.
        palette: ["#E8B04E"],
      }),
    })
  },
}
