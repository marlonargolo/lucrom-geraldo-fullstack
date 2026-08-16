"use client"

// Cliente pro pipeline REAL de produção (Director Engine, apps/api/src/engines/*)
// — diferente de lib/use-production.ts, que é uma simulação local. Todo tipo
// aqui espelha exatamente os DTOs reais do backend, validados contra
// Postgres real: CREATED → BUSINESS → STRATEGY → CREATIVE → PRODUCTION.
//
// QUALITY e DONE existem no enum do backend mas não têm rota de avanço
// implementada ainda — não expostos aqui.

import { getSession } from "@/lib/auth/session-store"

export type ProjectStage = "CREATED" | "BUSINESS" | "STRATEGY" | "CREATIVE" | "PRODUCTION" | "QUALITY" | "DONE" | "ABORTED"

export interface ProjectSession {
  id: string
  brand_id: string
  current_stage: ProjectStage
  business_ticket_id: string | null
  strategy_brief_id: string | null
  creative_manifest_id: string | null
  render_job_id: string | null
  quality_audit_id: string | null
  abort_reason: string | null
  created_at: string
  updated_at: string
}

export const BUSINESS_PROBLEM_CATEGORIES = ["HIGH_CAC", "LOW_AWARENESS", "POOR_CONVERSION", "BRAND_EROSION"] as const
export type BusinessProblemCategory = (typeof BUSINESS_PROBLEM_CATEGORIES)[number]

export interface AdvanceBusinessInput {
  brandId: string
  problemCategory: BusinessProblemCategory
  problemDescription: string
  targetMetric: string
  currentValue?: string
  targetValue?: string
}

export const STRATEGY_ANGLES = [
  "MYTH_BUSTING",
  "CONTRAST_CASE",
  "BEHIND_THE_CURTAIN",
  "PROVOCATIVE_QUESTION",
  "REVERSE_ENGINEERING",
] as const
export const PSYCHOLOGICAL_APPROACHES = ["LOSS_AVERSION", "SOCIAL_PROOF", "MYTH_DISRUPTION", "AUTHORITY"] as const
export const PRIMARY_CHANNELS = ["INSTAGRAM_REELS", "TIKTOK", "YOUTUBE_SHORTS", "LINKEDIN_VIDEO"] as const
export const DESIRED_EMOTIONS = ["RELIEF", "URGENCY", "EUREKA", "VALIDATION", "INDIGNATION"] as const
export const CTA_TYPES = ["COMMENT_AUTOMATION", "PROFILE_VISIT", "DIRECT_MESSAGE", "LINK_IN_BIO", "SAVE_FOR_LATER"] as const

export interface AdvanceStrategyInput {
  businessTicketId: string
  targetAudience: {
    personaName?: string
    manifestDesire: string
    hiddenFear: string
    culturalContradiction: string
  }
  coreThesis: string
  angle: (typeof STRATEGY_ANGLES)[number]
  psychologicalApproach: (typeof PSYCHOLOGICAL_APPROACHES)[number]
  primaryChannel: (typeof PRIMARY_CHANNELS)[number]
  desiredEmotion: (typeof DESIRED_EMOTIONS)[number]
  callToActionType: (typeof CTA_TYPES)[number]
  toneOfVoice?: string
}

export interface ProductionContract {
  id: string
  session_id: string
  ai_generation_job_id: string | null
  status: "READY" | "GENERATING" | "DISPATCH_FAILED"
  created_at: string
}

export type AiVideoJobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED"

export interface AiVideoJob {
  id: string
  status: AiVideoJobStatus
  provider: "kling" | "minimax"
  error_message: string | null
  download_url: string | null
}

async function call<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const session = getSession()
  if (!session) throw new Error("Faça login para usar o pipeline de produção real.")

  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", "X-User-Token": session.accessToken },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `Falha na chamada (HTTP ${res.status}).`)
  }
  return data as T
}

export const realProduction = {
  createSession: (brandId: string) => call<ProjectSession>("/api/production/sessions", "POST", { brandId }),
  getSession: (id: string) => call<ProjectSession>(`/api/production/sessions/${id}`, "GET"),
  advanceBusiness: (id: string, input: AdvanceBusinessInput) =>
    call<ProjectSession>(`/api/production/sessions/${id}/business`, "POST", input),
  advanceStrategy: (id: string, input: AdvanceStrategyInput) =>
    call<ProjectSession>(`/api/production/sessions/${id}/strategy`, "POST", input),
  advanceCreative: (id: string, voiceId?: string) =>
    call<ProjectSession>(`/api/production/sessions/${id}/creative`, "POST", voiceId ? { voiceId } : {}),
  advanceProduction: (id: string) => call<ProjectSession>(`/api/production/sessions/${id}/production`, "POST"),
  getProductionContract: (sessionId: string) =>
    call<ProductionContract>(`/api/production/sessions/${sessionId}/production-contract`, "GET"),
  getAiVideoStatus: (jobId: string) => call<AiVideoJob>(`/api/production/ai-video/${jobId}`, "GET"),
}
