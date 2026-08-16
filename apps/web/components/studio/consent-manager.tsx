"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ShieldCheck, ShieldAlert, Mic, Smile, Trash2, Ban, FileSignature, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type ConsentRecord,
  type ConsentType,
  addConsent,
  defaultTerm,
  deleteConsent,
  effectiveStatus,
  listConsents,
  onConsentChange,
  revokeConsent,
} from "@/lib/consent/consent-store"

const TYPE_META: Record<ConsentType, { label: string; icon: typeof Smile }> = {
  face: { label: "Rosto / Imagem", icon: Smile },
  voice: { label: "Voz", icon: Mic },
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function ConsentManager() {
  const [records, setRecords] = useState<ConsentRecord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const list = await listConsents()
      setRecords(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    return onConsentChange(refresh)
  }, [refresh])

  const activeCount = useMemo(
    () => records.filter((r) => effectiveStatus(r) === "active").length,
    [records],
  )

  return (
    <>
      <div className="mb-6 max-w-2xl">
        <h1 className="font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          Consentimento de <span className="text-primary">rosto e voz</span>, antes de produzir.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
          Nenhuma peça que use imagem ou voz de pessoa real é renderizada sem um termo válido registrado aqui.
          Os registros ficam no seu navegador (IndexedDB) e podem ser revogados a qualquer momento.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <ConsentForm />
        </div>
        <div className="lg:col-span-7">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="font-display text-sm font-bold">Termos registrados</h2>
            <span className="ml-auto rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {activeCount} válido(s)
            </span>
          </div>

          {loading ? (
            <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Carregando...
            </p>
          ) : records.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <ShieldAlert className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-sm text-muted-foreground text-pretty">
                Nenhum consentimento registrado. Peças com rosto/voz de pessoa real ficarão bloqueadas até
                registrar um termo.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {records.map((r) => (
                <ConsentCard key={r.id} record={r} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

function ConsentForm() {
  const [type, setType] = useState<ConsentType>("face")
  const [subject, setSubject] = useState("")
  const [document, setDocument] = useState("")
  const [scope, setScope] = useState("Campanhas orgânicas e mídia paga")
  const [validDays, setValidDays] = useState(365)
  const [term, setTerm] = useState(defaultTerm("face", ""))
  const [termEdited, setTermEdited] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  // mantém o termo padrão em sincronia com tipo/nome, salvo se o usuário editou.
  useEffect(() => {
    if (!termEdited) setTerm(defaultTerm(type, subject))
  }, [type, subject, termEdited])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setOk(null)
    if (!subject.trim()) return setError("Informe o nome do(a) titular.")
    if (!document.trim()) return setError("Informe um documento de identificação.")
    if (!agreed) return setError("É preciso confirmar o aceite do termo.")
    setSaving(true)
    try {
      await addConsent({ type, subject, document, scope, validDays, term })
      setOk(`Consentimento de ${TYPE_META[type].label.toLowerCase()} registrado para ${subject.trim()}.`)
      setSubject("")
      setDocument("")
      setAgreed(false)
      setTermEdited(false)
    } catch {
      setError("Não foi possível salvar. O navegador pode estar sem suporte a IndexedDB.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileSignature className="h-4 w-4" aria-hidden />
        </div>
        <h2 className="font-display text-sm font-bold">Novo termo</h2>
      </div>

      <Label>Tipo de consentimento</Label>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {(Object.keys(TYPE_META) as ConsentType[]).map((t) => {
          const Icon = TYPE_META[t].icon
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors",
                type === t
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {TYPE_META[t].label}
            </button>
          )
        })}
      </div>

      <Label>Nome do(a) titular</Label>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Ex.: Maria Silva"
        className="mb-3 w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40"
      />

      <Label>Documento (RG / CPF)</Label>
      <input
        value={document}
        onChange={(e) => setDocument(e.target.value)}
        placeholder="Ex.: 000.000.000-00"
        className="mb-3 w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40"
      />

      <Label>Escopo de uso autorizado</Label>
      <input
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        className="mb-3 w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/40"
      />

      <Label>Validade · {validDays} dias</Label>
      <input
        type="range"
        min={30}
        max={730}
        step={5}
        value={validDays}
        onChange={(e) => setValidDays(Number(e.target.value))}
        className="mb-3 w-full accent-primary"
      />

      <Label>Termo assinado</Label>
      <textarea
        value={term}
        onChange={(e) => {
          setTerm(e.target.value)
          setTermEdited(true)
        }}
        rows={4}
        className="mb-3 w-full resize-y rounded-xl border border-border bg-secondary px-3 py-2.5 text-[13px] leading-relaxed text-foreground outline-none transition-colors focus:border-primary/40"
      />

      <label className="mb-4 flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <span className="text-[12px] leading-snug text-muted-foreground">
          Confirmo que o(a) titular leu e aceitou este termo de forma livre e informada.
        </span>
      </label>

      {error && (
        <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}
      {ok && !error && (
        <p className="mb-3 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">{ok}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ShieldCheck className="h-4 w-4" aria-hidden />
        {saving ? "Registrando..." : "Registrar consentimento"}
      </button>
    </form>
  )
}

function ConsentCard({ record }: { record: ConsentRecord }) {
  const status = effectiveStatus(record)
  const Icon = TYPE_META[record.type].icon
  const badge =
    status === "active"
      ? { label: "válido", cls: "bg-success/15 text-success" }
      : status === "revoked"
        ? { label: "revogado", cls: "bg-destructive/15 text-destructive" }
        : { label: "expirado", cls: "bg-warning/15 text-warning" }

  return (
    <li
      className={cn(
        "rounded-2xl border p-4",
        status === "active" ? "border-border bg-card" : "border-border bg-card/60",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-foreground">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{record.subject}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {TYPE_META[record.type].label} · doc {record.document}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold", badge.cls)}>
          {badge.label}
        </span>
      </div>

      <p className="mt-2.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">{record.term}</p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden />
          {fmtDate(record.validFrom)} – {fmtDate(record.validUntil)}
        </span>
        <span>escopo: {record.scope}</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {status === "active" && (
          <button
            type="button"
            onClick={() => revokeConsent(record.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            <Ban className="h-3.5 w-3.5" aria-hidden />
            Revogar
          </button>
        )}
        <button
          type="button"
          onClick={() => deleteConsent(record.id)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Excluir
        </button>
      </div>
    </li>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  )
}
