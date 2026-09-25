"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ShieldCheck, Plus, Mic, Smile, Trash2, Ban, Clock, CheckCircle2, AlertCircle } from "lucide-react"
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

const TYPE_META: Record<ConsentType, { label: string; Icon: typeof Smile }> = {
  face:  { label: "Rosto / Imagem", Icon: Smile },
  voice: { label: "Voz",            Icon: Mic   },
}

const STATUS_META = {
  active:  { label: "consentido", color: "text-green-500",  bg: "bg-green-500/10",  Icon: CheckCircle2 },
  revoked: { label: "revogado",   color: "text-destructive", bg: "bg-destructive/10", Icon: Ban },
  expired: { label: "expirado",   color: "text-muted-foreground", bg: "bg-muted", Icon: Clock },
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function ConsentimentoPage() {
  const [records, setRecords] = useState<ConsentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<ConsentType>("face")
  const [subject, setSubject] = useState("")
  const [document, setDocument] = useState("")
  const [scope, setScope] = useState("Campanhas orgânicas e mídia paga")
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    try { setRecords(await listConsents()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh(); return onConsentChange(refresh) }, [refresh])

  const activeCount = useMemo(() => records.filter((r) => effectiveStatus(r) === "active").length, [records])

  const handleAdd = async () => {
    if (!subject.trim() || !document.trim()) return
    setSaving(true)
    try {
      await addConsent({ type, subject, document, scope, term: document, validDays: 365 })
      setSubject(""); setDocument(""); setShowForm(false)
    } finally { setSaving(false) }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Gerenciador de Consentimento</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {activeCount} {activeCount === 1 ? "consentimento ativo" : "consentimentos ativos"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition hover:brightness-110 active:scale-95"
        >
          <Plus className="h-4 w-4" /> Novo consentimento
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
        {/* Formulário */}
        {showForm && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <p className="mb-4 text-[13px] font-semibold text-foreground">Registrar novo consentimento</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Tipo */}
              <div className="col-span-2 flex gap-2">
                {(["face", "voice"] as ConsentType[]).map((t) => {
                  const { label, Icon } = TYPE_META[t]
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        "flex flex-1 items-center gap-2 rounded-xl border p-3 text-[12px] font-medium transition-all",
                        type === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  )
                })}
              </div>
              <input
                placeholder="Nome da pessoa"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
              <input
                placeholder="Documento (RG/CPF)"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
              <input
                placeholder="Escopo de uso"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleAdd}
                disabled={saving || !subject.trim() || !document.trim()}
                className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50 active:scale-95"
              >
                {saving ? "Salvando…" : "Registrar"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-border px-4 py-2 text-[13px] text-muted-foreground transition hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Painel de permissões */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-[13px] font-semibold text-foreground">Permissões de uso de imagem e voz</p>
          </div>
          <p className="mb-4 text-[12px] text-muted-foreground">
            Gerencie os consentimentos para geração de avatares e locuções.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <div className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
              Carregando...
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-[13px] text-muted-foreground">Nenhum consentimento registrado ainda.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {records.map((r) => {
                const st = effectiveStatus(r)
                const { label, color, bg, Icon } = STATUS_META[st]
                const { Icon: TypeIcon } = TYPE_META[r.type]
                return (
                  <div
                    key={r.id}
                    className="group flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 transition-all hover:border-border/80 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <TypeIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{r.subject}</p>
                        <p className="text-[11px] text-muted-foreground">{TYPE_META[r.type].label} · válido até {fmtDate(r.validUntil)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", bg, color)}>
                        <Icon className="h-3 w-3" /> {label}
                      </span>
                      {st === "active" && (
                        <button
                          type="button"
                          onClick={() => revokeConsent(r.id)}
                          title="Revogar"
                          className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteConsent(r.id)}
                        title="Excluir"
                        className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
