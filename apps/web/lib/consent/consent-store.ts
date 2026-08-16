// Registro de consentimento (rosto/voz) persistido localmente em IndexedDB.
// Fase client-side: guarda o termo assinado, validade e permite revogação.
// A camada de UI e o gerador de vídeo consultam `hasValidConsent` antes de
// produzir peças que usam pessoa real (LGPD / direito de imagem e voz).
//
// UNIFICAÇÃO: além do IndexedDB local, o aceite agora também é persistido no
// backend (POST /api/v1/consent), que grava como status LEGAL_CONSENT_GRANTED
// — ver ConsentService.create() em apps/api. A chamada é "best-effort": se a
// API não estiver configurada/disponível, o fluxo local continua funcionando
// exatamente como antes (o app não depende do backend para operar).

import { apiFetch, isApiConfigured, DEFAULT_TENANT_ID } from '../api/client'

export type ConsentType = "face" | "voice"
export type ConsentStatus = "active" | "revoked" | "expired"

export interface ConsentRecord {
  id: string
  type: ConsentType
  /** Nome da pessoa que cedeu o rosto/voz. */
  subject: string
  /** Documento de identificação (RG/CPF/etc.) declarado. */
  document: string
  /** Texto do termo aceito no momento da assinatura. */
  term: string
  /** Escopo de uso autorizado (ex.: campanhas orgânicas, mídia paga). */
  scope: string
  signedAt: number
  /** Início e fim de validade (epoch ms). */
  validFrom: number
  validUntil: number
  revokedAt?: number
  /** id do registro espelhado em POST /api/v1/consent (backend), se a API estava disponível. */
  backendId?: string
}

const DB_NAME = "lucrom-consent"
const STORE = "consents"
const DB_VERSION = 1

function isBrowser() {
  return typeof window !== "undefined" && "indexedDB" in window
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error("IndexedDB indisponível"))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" })
        os.createIndex("type", "type", { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir o banco"))
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const store = t.objectStore(STORE)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error("Falha na transação"))
        t.oncomplete = () => db.close()
      }),
  )
}

/** Deriva o status efetivo considerando revogação e validade. */
export function effectiveStatus(r: ConsentRecord, now = Date.now()): ConsentStatus {
  if (r.revokedAt) return "revoked"
  if (now > r.validUntil || now < r.validFrom) return "expired"
  return "active"
}

export function isValid(r: ConsentRecord, now = Date.now()): boolean {
  return effectiveStatus(r, now) === "active"
}

const CONSENT_EVENT = "lucrom-consent-changed"

function emitChange() {
  if (isBrowser()) window.dispatchEvent(new Event(CONSENT_EVENT))
}

export function onConsentChange(cb: () => void): () => void {
  if (!isBrowser()) return () => {}
  window.addEventListener(CONSENT_EVENT, cb)
  return () => window.removeEventListener(CONSENT_EVENT, cb)
}

export async function listConsents(): Promise<ConsentRecord[]> {
  const all = await tx<ConsentRecord[]>("readonly", (s) => s.getAll() as IDBRequest<ConsentRecord[]>)
  return (all ?? []).sort((a, b) => b.signedAt - a.signedAt)
}

export interface NewConsentInput {
  type: ConsentType
  subject: string
  document: string
  scope: string
  validDays: number
  term: string
}

export async function addConsent(input: NewConsentInput): Promise<ConsentRecord> {
  const now = Date.now()
  const record: ConsentRecord = {
    id: `consent-${now}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    subject: input.subject.trim(),
    document: input.document.trim(),
    scope: input.scope.trim(),
    term: input.term.trim(),
    signedAt: now,
    validFrom: now,
    validUntil: now + input.validDays * 24 * 60 * 60 * 1000,
  }
  await tx("readwrite", (s) => s.put(record))
  emitChange()

  // Espelha no backend como LEGAL_CONSENT_GRANTED (best-effort — nunca bloqueia
  // nem quebra o fluxo local se a API não estiver configurada/disponível).
  if (isApiConfigured()) {
    try {
      const backend = await apiFetch<{ id: string }>('/api/v1/consent', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: DEFAULT_TENANT_ID,
          subject_type: record.type,
          subject_name: record.subject,
          expires_at: new Date(record.validUntil).toISOString(),
        }),
      })
      record.backendId = backend.id
      await tx("readwrite", (s) => s.put(record))
    } catch (err) {
      console.warn('[consent-store] Falha ao persistir consentimento no backend (mantendo apenas local):', err)
    }
  }

  return record
}

export async function revokeConsent(id: string): Promise<void> {
  const record = await tx<ConsentRecord | undefined>("readonly", (s) => s.get(id) as IDBRequest<ConsentRecord | undefined>)
  if (!record) return
  record.revokedAt = Date.now()
  await tx("readwrite", (s) => s.put(record))
  emitChange()

  if (isApiConfigured() && record.backendId) {
    try {
      await apiFetch(`/api/v1/consent/${record.backendId}/revoke`, { method: 'POST' })
    } catch (err) {
      console.warn('[consent-store] Falha ao revogar consentimento no backend (mantendo apenas local):', err)
    }
  }
}

export async function deleteConsent(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id))
  emitChange()
}

/** Existe ao menos um consentimento válido do tipo pedido? */
export async function hasValidConsent(type: ConsentType): Promise<boolean> {
  const all = await listConsents()
  return all.some((r) => r.type === type && isValid(r))
}

/** Modelo de termo pré-preenchido para o tipo de consentimento. */
export function defaultTerm(type: ConsentType, subject: string): string {
  const who = subject.trim() || "o(a) titular"
  if (type === "voice") {
    return (
      `Eu, ${who}, autorizo de forma livre e informada o uso da minha voz em peças ` +
      `de comunicação produzidas neste estúdio, incluindo síntese e edição de locução, ` +
      `pelo período de validade abaixo. Estou ciente do direito de revogar este consentimento a qualquer momento.`
    )
  }
  return (
    `Eu, ${who}, autorizo de forma livre e informada o uso da minha imagem e semelhança ` +
    `(rosto/avatar) em peças de comunicação produzidas neste estúdio, pelo período de validade abaixo. ` +
    `Estou ciente do direito de revogar este consentimento a qualquer momento.`
  )
}
