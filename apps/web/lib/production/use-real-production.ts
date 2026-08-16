"use client"

import { useCallback, useState } from "react"
import {
  realProduction,
  type ProjectSession,
  type AdvanceBusinessInput,
  type AdvanceStrategyInput,
} from "./real-production-client"

export type RealProductionStep = "idle" | "creating" | "business" | "strategy" | "creative" | "production"

export function useRealProduction() {
  const [session, setSession] = useState<ProjectSession | null>(null)
  const [step, setStep] = useState<RealProductionStep>("idle")
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setSession(null)
    setStep("idle")
    setError(null)
  }, [])

  const createSession = useCallback(async (brandId: string) => {
    setStep("creating")
    setError(null)
    try {
      const s = await realProduction.createSession(brandId)
      setSession(s)
      return s
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar sessão.")
      throw e
    } finally {
      setStep("idle")
    }
  }, [])

  const advanceBusiness = useCallback(async (input: AdvanceBusinessInput) => {
    if (!session) return
    setStep("business")
    setError(null)
    try {
      const s = await realProduction.advanceBusiness(session.id, input)
      setSession(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no Business Engine.")
    } finally {
      setStep("idle")
    }
  }, [session])

  const advanceStrategy = useCallback(async (input: AdvanceStrategyInput) => {
    if (!session) return
    setStep("strategy")
    setError(null)
    try {
      const s = await realProduction.advanceStrategy(session.id, input)
      setSession(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no Strategy Engine.")
    } finally {
      setStep("idle")
    }
  }, [session])

  const advanceCreative = useCallback(async (voiceId?: string) => {
    if (!session) return
    setStep("creative")
    setError(null)
    try {
      const s = await realProduction.advanceCreative(session.id, voiceId)
      setSession(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no Creative Engine.")
    } finally {
      setStep("idle")
    }
  }, [session])

  const advanceProduction = useCallback(async () => {
    if (!session) return
    setStep("production")
    setError(null)
    try {
      const s = await realProduction.advanceProduction(session.id)
      setSession(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar o contrato de produção.")
    } finally {
      setStep("idle")
    }
  }, [session])

  return {
    session,
    step,
    error,
    busy: step !== "idle",
    reset,
    createSession,
    advanceBusiness,
    advanceStrategy,
    advanceCreative,
    advanceProduction,
  }
}
