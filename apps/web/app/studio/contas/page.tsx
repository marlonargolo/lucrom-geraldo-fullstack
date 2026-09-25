"use client"

import { useState } from "react"
import { ArrowLeft, Camera, Link2, Plus, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react"

const platforms = [
  { name: "Instagram", detail: "Publicação, métricas e comentários", tone: "from-[#d946ef] via-[#e11d48] to-[#f97316]", connected: true },
  { name: "TikTok", detail: "Vídeos curtos e tendências", tone: "from-[#111827] to-[#030712]", connected: false },
  { name: "YouTube", detail: "Shorts e vídeos do canal", tone: "from-[#ef4444] to-[#b91c1c]", connected: false },
  { name: "Threads", detail: "Textos e conversas", tone: "from-[#374151] to-[#111827]", connected: false },
]

export default function ContasPage() {
  const [selected, setSelected] = useState<string | null>(null)
  // A conexão OAuth depende do backend/Meta Graph API. Keep the local page
  // useful for exploring the flow, but never present a client-side toggle as
  // a successful external connection.
  const connected: string[] = []
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-4">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => history.back()} className="mt-1 rounded-xl border border-border p-2 text-muted-foreground hover:bg-accent" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></button>
        <div><p className="font-mono text-[11px] uppercase tracking-widest text-primary">Distribuição</p><h1 className="font-display text-3xl font-bold tracking-tight">Contas sociais</h1><p className="mt-1 text-sm text-muted-foreground">Conecte suas contas para agendar, gerenciar e analisar conteúdo direto do Criatai.</p></div>
      </div>
       <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><div className="flex items-start gap-3"><div className="rounded-xl bg-primary/15 p-2 text-primary"><Sparkles className="h-5 w-5" /></div><div><p className="font-semibold">Conecte sua primeira conta</p><p className="mt-1 text-sm text-muted-foreground">A conexão OAuth será liberada quando o backend de publicação estiver configurado.</p></div></div></div>
      <div><p className="mb-3 text-center text-sm text-muted-foreground">Usado por equipes que criam todos os dias</p><h2 className="text-center font-display text-2xl font-bold">Selecione uma plataforma para conectar</h2></div>
      <div className="grid gap-4 sm:grid-cols-2">{platforms.map((platform) => { const isConnected = connected.includes(platform.name); return <button key={platform.name} type="button" onClick={() => setSelected(platform.name)} className={`group relative min-h-36 overflow-hidden rounded-2xl bg-gradient-to-br ${platform.tone} p-5 text-left text-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl`}><div className="flex h-full flex-col justify-between"><div className="flex items-center justify-between"><Camera className="h-7 w-7" /><span className="rounded-full bg-white/15 px-2 py-1 text-[11px]">{isConnected ? "Conectada" : "Disponível"}</span></div><div><p className="text-xl font-bold">{platform.name}</p><p className="mt-1 text-sm text-white/75">{platform.detail}</p></div></div></button> })}</div>
      <div className="flex items-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Seus tokens ficam protegidos no servidor e você pode revogar o acesso quando quiser.</div>
       {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-0 sm:items-center sm:p-4" onClick={() => setSelected(null)}><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-t-3xl bg-card p-6 shadow-2xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}><div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border sm:hidden" /><div className="flex justify-end"><button type="button" onClick={() => setSelected(null)} aria-label="Fechar"><X className="h-5 w-5 text-muted-foreground" /></button></div><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"><Link2 className="h-8 w-8" /></div><h2 className="mt-4 text-center font-display text-2xl font-bold">Conecte sua conta {selected}</h2><p className="mx-auto mt-2 max-w-sm text-center leading-relaxed text-muted-foreground">A autorização segura depende do backend de publicação e da integração oficial da plataforma.</p><div className="mt-6 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-left text-xs text-warning"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>Integração indisponível neste ambiente. Nenhuma conta foi conectada.</span></div><button type="button" onClick={() => setSelected(null)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold text-foreground hover:bg-accent"><Plus className="h-4 w-4" /> Fechar</button></div></div>}
    </div>
  )
}
