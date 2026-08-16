"use client"

import { useEffect, useRef, useState } from "react"
import { realProduction, type AiVideoJob } from "./real-production-client"

const POLL_INTERVAL_MS = 5000

/**
 * Acompanha o progresso da geração de vídeo disparada por
 * `advanceProduction`: primeiro busca o contrato de produção da sessão pra
 * descobrir o `ai_generation_job_id` (pode ainda não existir, se o disparo
 * falhou — `DISPATCH_FAILED`), depois faz polling em
 * GET /api/production/ai-video/:id a cada 5s até o job chegar em
 * DONE ou FAILED.
 */
export function useAiVideoStatus(sessionId: string | undefined, active: boolean) {
  const [job, setJob] = useState<AiVideoJob | null>(null)
  const [dispatchFailed, setDispatchFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active || !sessionId) return

    let cancelled = false

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const pollJob = async (jobId: string) => {
      try {
        const j = await realProduction.getAiVideoStatus(jobId)
        if (cancelled) return
        setJob(j)
        if (j.status === "DONE" || j.status === "FAILED") stopPolling()
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Falha ao consultar status da geração.")
        stopPolling()
      }
    }

    const start = async () => {
      try {
        const contract = await realProduction.getProductionContract(sessionId)
        if (cancelled) return
        if (contract.status === "DISPATCH_FAILED" || !contract.ai_generation_job_id) {
          setDispatchFailed(true)
          return
        }
        await pollJob(contract.ai_generation_job_id)
        intervalRef.current = setInterval(() => pollJob(contract.ai_generation_job_id!), POLL_INTERVAL_MS)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Falha ao consultar o contrato de produção.")
      }
    }

    start()

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [sessionId, active])

  return { job, dispatchFailed, error }
}
