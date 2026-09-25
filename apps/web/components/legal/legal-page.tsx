"use client"

import { ArrowLeft, FileText, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LegalLinks } from "@/components/legal/legal-links"
import { LEGAL_POLICIES, type LegalPolicyId } from "@/lib/legal/policies"

export default function LegalPage({ policyId }: { policyId: LegalPolicyId }) {
  const policy = LEGAL_POLICIES[policyId]
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              L
            </span>
            Criatai <span className="text-primary">Studio</span>
          </Link>
          <button
            type="button"
             onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Voltar
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-8 md:grid-cols-[220px_minmax(0,760px)] md:px-8 md:py-12">
        <aside className="h-fit rounded-2xl border border-border bg-card p-4 md:sticky md:top-6">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Central legal
          </div>
          <LegalLinks className="flex-col items-start gap-3" />
          <div className="mt-5 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
            Versão {policy.version}
            <br />
            Vigente desde {policy.effectiveDate}
          </div>
        </aside>

        <article className="min-w-0">
          <div className="mb-8 border-b border-border pb-8">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" aria-hidden />
            </div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
              Documento vigente · {policy.version}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-5xl">{policy.title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">{policy.summary}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              Última atualização: {policy.effectiveDate}. Este conteúdo deve ser revisado com a assessoria jurídica da empresa antes da publicação definitiva.
            </p>
          </div>

          <div className="space-y-8">
            {policy.sections.map((section) => (
              <section key={section.heading} className="scroll-mt-8">
                <h2 className="font-display text-xl font-semibold tracking-tight">{section.heading}</h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.bullets && (
                    <ul className="list-disc space-y-2 pl-5 marker:text-primary">
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm leading-6 text-muted-foreground">
            <strong className="text-foreground">Precisa de ajuda?</strong>{" "}
            Entre em contato pelo canal indicado nesta política ou volte ao{" "}
             <Link href="/studio/login" className="font-semibold text-primary hover:underline">
              acesso ao Studio
            </Link>
            .
          </div>
        </article>
      </main>
    </div>
  )
}
