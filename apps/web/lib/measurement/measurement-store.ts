// Ponte entre a aba "Vídeo" (onde uma peça real é medida) e a aba "Estúdio"
// (onde os Audit Gates decidem). Guarda a última medição AV real feita a partir
// de uma peça renderizada de verdade, para que o portão de Qualidade Audiovisual
// use um número medido — e não uma simulação.

import type { FidelityReport } from "./fidelity"

const KEY = "lucrom-last-av-measurement"
const EVENT = "lucrom-measurement-changed"

export interface StoredMeasurement {
  report: FidelityReport
  /** Rótulo do que foi medido (ex.: nome do vídeo/tema). */
  label: string
}

function isBrowser() {
  return typeof window !== "undefined"
}

export function saveMeasurement(m: StoredMeasurement) {
  if (!isBrowser()) return
  try {
    localStorage.setItem(KEY, JSON.stringify(m))
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* storage indisponível */
  }
}

export function getMeasurement(): StoredMeasurement | null {
  if (!isBrowser()) return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StoredMeasurement) : null
  } catch {
    return null
  }
}

export function clearMeasurement() {
  if (!isBrowser()) return
  localStorage.removeItem(KEY)
  window.dispatchEvent(new Event(EVENT))
}

export function onMeasurementChange(cb: () => void): () => void {
  if (!isBrowser()) return () => {}
  window.addEventListener(EVENT, cb)
  return () => window.removeEventListener(EVENT, cb)
}
