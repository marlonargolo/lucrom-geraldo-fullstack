"use client"

import { useCallback, useRef, useState } from "react"
import { ENGINES, LAYERS, AUDIT_GATES, type EngineId } from "./studio-data"
import { getMeasurement } from "./measurement/measurement-store"

export type EngineStatus = "pending" | "active" | "done"
// Ciclo de vida do portão: aguardando pipeline → auto-crítica aprovou →
// decisão humana registrada (aprovado/reprovado).
export type GateStatus = "pending" | "auto_pass" | "approved" | "rejected"
// "review" = pipeline terminou, aguardando aprovação humana nos 3 portões.
export type ProductionStatus = "idle" | "running" | "review" | "done"

export interface LogEntry {
  id: number
  engine: EngineId
  role: string
  msg: string
}

// Uma versão de uma camada — o histórico v1→vN de cada camada de produção.
export interface LayerVersion {
  version: number
  note: string
  source: "auto" | "human"
  at: number
}

export interface GateResult {
  status: GateStatus
  score: number
  revisions: number // rodadas da auto-crítica até bater o critério
  // true = score veio de medição objetiva real (peça renderizada + referência).
  // false = simulação, pois não há sinal real para este critério nesta fase.
  measured: boolean
  /** Rótulo da peça medida, quando measured=true. */
  measuredLabel?: string
  decidedBy?: string
  decidedAt?: number
}

// Registro de auditoria — quem decidiu o quê, quando (base de audit_gate_logs).
export interface AuditEntry {
  id: number
  gateId: string
  gateName: string
  action: "approved" | "rejected"
  reviewer: string
  score: number
  revisions: number
  at: number
}

export interface ProductionState {
  status: ProductionStatus
  brief: string
  brandId: string
  engineStatus: Record<EngineId, EngineStatus>
  doneLayers: string[]
  layerVersions: Record<string, LayerVersion[]>
  gates: Record<string, GateResult>
  auditLog: AuditEntry[]
  fidelity: number
  logs: LogEntry[]
  progress: number // 0..100
}

// ---- Determinismo: sem Math.random ----------------------------------------
// Hash estável de uma string (FNV-1a) para semear o gerador pseudoaleatório.
function hashString(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// Mulberry32 — PRNG determinístico e reproduzível a partir de uma semente.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const initialEngineStatus = () =>
  ENGINES.reduce(
    (acc, e) => {
      acc[e.id] = "pending"
      return acc
    },
    {} as Record<EngineId, EngineStatus>,
  )

const initialGates = () =>
  AUDIT_GATES.reduce(
    (acc, g) => {
      acc[g.id] = { status: "pending", score: 0, revisions: 0, measured: false }
      return acc
    },
    {} as Record<string, GateResult>,
  )

const initialState = (): ProductionState => ({
  status: "idle",
  brief: "",
  brandId: "",
  engineStatus: initialEngineStatus(),
  doneLayers: [],
  layerVersions: {},
  gates: initialGates(),
  auditLog: [],
  fidelity: 0,
  logs: [],
  progress: 0,
})

// Mensagens de "bastidor" — o que cada motor reporta ao concluir
const ENGINE_MESSAGES: Record<EngineId, string> = {
  M1: "Objetivo, público e KPI mapeados a partir do briefing.",
  M2: "Big idea definida — conceito central aprovado internamente.",
  M3: "Headline, corpo e CTA escritos no tom de voz da marca (A/B).",
  M4: "Roteiro em 5 cenas e storyboard de referência prontos.",
  M5: "Paleta, tipografia e grid travados conforme o Brand Kit.",
  M6: "Planos e avatares gerados com consistência de identidade.",
  M7: "Locução consentida, trilha original e SFX sincronizados.",
  M8: "Montagem, color grade e mix finalizados — look cinematográfico.",
  M9: "Fidelidade objetiva medida vs. referência (cor/ruído/LUFS).",
  M10: "3 portões avaliados; auto-crítica reescreveu até bater o critério.",
  M11: "Adaptado para 9:16, 1:1 e 16:9 automaticamente.",
  M12: "Peça enfileirada para aprovação humana antes de publicar.",
  M13: "Baseline de performance definida para o próximo ciclo.",
}

const STEP_MS = 620

// SIMULAÇÃO honesta: para os critérios sem sinal objetivo nesta fase
// (compliance de marca e tom de voz), gera um score determinístico apenas para
// demonstrar o fluxo. É sempre marcado como measured=false na UI, para nunca
// se passar por medição real.
function simulateGate(threshold: number, rand: () => number) {
  let score = 96 + rand() * 2.5 // 96.0 .. 98.5 — começa reprovado
  let revisions = 0
  while (score < threshold && revisions < 6) {
    revisions += 1
    score += 0.6 + rand() * 0.8 // cada revisão aproxima do alvo
  }
  score = Math.min(99.9, Number(score.toFixed(1)))
  return { score, revisions: Math.max(1, revisions) }
}

export function useProduction() {
  const [state, setState] = useState<ProductionState>(initialState)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logId = useRef(0)
  const auditId = useRef(0)

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const reset = useCallback(() => {
    stop()
    logId.current = 0
    auditId.current = 0
    setState(initialState())
  }, [stop])

  const start = useCallback(
    (brief: string, brandId: string) => {
      stop()
      logId.current = 0
      auditId.current = 0
      // Semente derivada do briefing + marca → resultado reproduzível.
      const seed = hashString(`${brandId}::${brief}`)
      const rand = mulberry32(seed)

      setState({ ...initialState(), status: "running", brief, brandId })

      let i = 0

      const step = () => {
        const engine = ENGINES[i]
        if (!engine) {
          // Pipeline terminou. A auto-crítica já preencheu os portões;
          // agora aguarda decisão humana → status "review".
          setState((s) => ({ ...s, status: "review", progress: 100 }))
          return
        }

        setState((s) => ({
          ...s,
          engineStatus: { ...s.engineStatus, [engine.id]: "active" },
        }))

        timer.current = setTimeout(() => {
          setState((s) => {
            const engineStatus = { ...s.engineStatus, [engine.id]: "done" as EngineStatus }
            const at = Date.now()

            // Cada camada nasce na versão v1 quando seu motor conclui.
            const layerVersions = { ...s.layerVersions }
            const newLayerKeys: string[] = []
            for (const l of LAYERS.filter((l) => l.engine === engine.id)) {
              newLayerKeys.push(l.key)
              if (!layerVersions[l.key]) {
                layerVersions[l.key] = [{ version: 1, note: "Gerada pelo motor", source: "auto", at }]
              }
            }
            const doneLayers = Array.from(new Set([...s.doneLayers, ...newLayerKeys]))

            const logs = [
              ...s.logs,
              { id: ++logId.current, engine: engine.id, role: engine.role, msg: ENGINE_MESSAGES[engine.id] },
            ]

            // M10 avalia os 3 portões. O portão de Qualidade Audiovisual usa a
            // MEDIÇÃO REAL feita na aba Vídeo (se existir); os demais critérios,
            // sem sinal objetivo nesta fase, ficam explicitamente como simulação.
            let gates = s.gates
            let fidelity = s.fidelity
            if (engine.id === "M10") {
              gates = { ...s.gates }
              const real = getMeasurement()
              const hasRealAV = !!real?.report.hasReference
              for (const g of AUDIT_GATES) {
                if (g.id === "av" && real && hasRealAV) {
                  gates[g.id] = {
                    status: "auto_pass",
                    score: real.report.score,
                    revisions: 0,
                    measured: true,
                    measuredLabel: real.label,
                  }
                } else {
                  const { score, revisions } = simulateGate(g.threshold, rand)
                  gates[g.id] = { status: "auto_pass", score, revisions, measured: false }
                }
              }
              const scores = Object.values(gates).map((g) => g.score)
              fidelity = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
            }

            const progress = Math.round(((i + 1) / ENGINES.length) * 100)
            return { ...s, engineStatus, doneLayers, layerVersions, logs, gates, fidelity, progress }
          })

          i += 1
          step()
        }, STEP_MS)
      }

      step()
    },
    [stop],
  )

  // Reforço 1 — refinar uma camada cria uma NOVA versão (v(N+1)), preservando
  // o histórico. Nunca regenera a peça inteira.
  const refineLayer = useCallback((key: string, note: string) => {
    setState((s) => {
      const history = s.layerVersions[key] ?? []
      if (history.length === 0) return s
      const nextVersion = history[history.length - 1].version + 1
      const entry: LayerVersion = {
        version: nextVersion,
        note: note.trim() || "Refinamento manual",
        source: "human",
        at: Date.now(),
      }
      return { ...s, layerVersions: { ...s.layerVersions, [key]: [...history, entry] } }
    })
  }, [])

  // Reforço 4 — decisão humana no portão, registrada em audit log.
  const decideGate = useCallback(
    (gateId: string, action: "approved" | "rejected", reviewer: string) => {
      setState((s) => {
        const gate = s.gates[gateId]
        const gateDef = AUDIT_GATES.find((g) => g.id === gateId)
        if (!gate || !gateDef) return s
        const at = Date.now()
        const gates = {
          ...s.gates,
          [gateId]: {
            ...gate,
            status: action === "approved" ? ("approved" as const) : ("rejected" as const),
            decidedBy: reviewer,
            decidedAt: at,
          },
        }
        const auditLog = [
          ...s.auditLog,
          {
            id: ++auditId.current,
            gateId,
            gateName: gateDef.name,
            action,
            reviewer,
            score: gate.score,
            revisions: gate.revisions,
            at,
          },
        ]
        // Se os 3 portões estiverem aprovados, a peça está pronta.
        const allApproved = AUDIT_GATES.every((g) => gates[g.id].status === "approved")
        const status: ProductionStatus = allApproved ? "done" : s.status
        return { ...s, gates, auditLog, status }
      })
    },
    [],
  )

  return { state, start, reset, refineLayer, decideGate }
}
