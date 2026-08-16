"use client"

import {
  Database,
  Boxes,
  Server,
  ShieldCheck,
  Cpu,
  HardDrive,
  Network,
  Activity,
  Layers,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { TABLES, SERVICES, INFRA, NFRS, DATA_FLOW, type TableDef } from "@/lib/architecture-data"

const INFRA_ICONS: Record<string, typeof Database> = {
  db: Database,
  queue: Network,
  storage: HardDrive,
  gpu: Cpu,
  cache: Activity,
  obs: Activity,
}

export function ArchitectureBlueprint() {
  return (
    <div className="flex flex-col gap-4">
      {/* intro */}
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          Arquitetura, dados e infra —{" "}
          <span className="text-primary">pronta para escala</span>.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
          Multi-tenancy por padrão, microsserviços que escalam de forma independente e um modelo de dados
          desenhado para compliance. Este blueprint vira o schema quando o banco for plugado.
        </p>
      </div>

      {/* NFRs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {NFRS.map((n) => (
          <div key={n.label} className="rounded-xl border border-border bg-card p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{n.label}</p>
            <p className="mt-1 font-display text-lg font-bold text-primary">{n.value}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{n.note}</p>
          </div>
        ))}
      </section>

      {/* fluxo de dados */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle icon={Network} title="Fluxo de ponta a ponta" hint="do briefing à publicação" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {DATA_FLOW.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 font-mono text-[11px]",
                  i === 0 || i === DATA_FLOW.length - 1
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-secondary text-foreground",
                )}
              >
                {step}
              </span>
              {i < DATA_FLOW.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* microsserviços */}
        <section className="rounded-2xl border border-border bg-card p-4 lg:col-span-7">
          <SectionTitle icon={Boxes} title="Microsserviços" hint="7 serviços · escala independente" />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SERVICES.map((s) => (
              <div key={s.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" aria-hidden />
                    <span className="text-sm font-semibold">{s.name}</span>
                  </div>
                  {s.engines && (
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {s.engines}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{s.role}</p>
                <p className="mt-1.5 font-mono text-[10px] text-primary/80">{s.scale}</p>
              </div>
            ))}
          </div>
        </section>

        {/* infra */}
        <section className="rounded-2xl border border-border bg-card p-4 lg:col-span-5">
          <SectionTitle icon={HardDrive} title="Camada de infraestrutura" hint="dados · filas · GPU" />
          <div className="mt-3 flex flex-col gap-2">
            {INFRA.map((item) => {
              const Icon = INFRA_ICONS[item.id] ?? Database
              return (
                <div key={item.id} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" aria-hidden />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{item.name}</span>
                      <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {item.tech}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{item.role}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* modelo de dados */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle
          icon={Database}
          title="Modelo de dados"
          hint="8 tabelas · multi-tenant · 3 exigidas no documento"
        />
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {TABLES.map((t) => (
            <TableCard key={t.name} table={t} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <Legend className="bg-primary" label="chave primária" />
          <Legend className="bg-chart-4" label="chave estrangeira" />
          <Legend className="bg-success" label="isolamento de tenant" />
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden /> exigida no documento mestre
          </span>
        </div>
      </section>
    </div>
  )
}

function TableCard({ table }: { table: TableDef }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-3 py-2">
        <Layers className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="font-mono text-[12px] font-semibold">{table.name}</span>
        {table.fromDoc && (
          <ShieldCheck className="ml-auto h-3.5 w-3.5 text-primary" aria-label="exigida no documento" />
        )}
      </div>
      <p className="px-3 pt-2 text-[11px] leading-relaxed text-muted-foreground">{table.purpose}</p>
      <ul className="flex flex-col gap-0.5 p-2">
        {table.columns.map((c) => (
          <li key={c.name} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-secondary/50">
            <span className="flex items-center gap-1.5">
              {c.pk && <Dot className="bg-primary" title="PK" />}
              {c.fk && <Dot className="bg-chart-4" title={`FK → ${c.fk}`} />}
              {c.tenant && <Dot className="bg-success" title="tenant" />}
              {!c.pk && !c.fk && !c.tenant && <span className="w-1.5" />}
            </span>
            <span className="font-mono text-[11px] text-foreground">{c.name}</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">{c.type}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SectionTitle({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Database
  title: string
  hint: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      <h2 className="font-display text-sm font-semibold">{title}</h2>
      <span className="ml-auto font-mono text-[10px] text-muted-foreground">{hint}</span>
    </div>
  )
}

function Dot({ className, title }: { className: string; title: string }) {
  return <span className={cn("h-1.5 w-1.5 rounded-full", className)} title={title} aria-label={title} />
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", className)} aria-hidden />
      {label}
    </span>
  )
}
