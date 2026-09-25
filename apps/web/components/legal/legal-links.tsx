import Link from "next/link"
import { cn } from "@/lib/utils"

type LegalLinksProps = {
  className?: string
  variant?: "panel" | "marketing"
}

export function LegalLinks({ className, variant = "panel" }: LegalLinksProps) {
  if (variant === "marketing") {
    return (
      <nav
        aria-label="Documentos legais"
        className={cn("flex flex-wrap gap-x-4 gap-y-2", className)}
      >
        <Link href="/termos" className="text-sm text-white/55 transition hover:text-white">
          Termos de Uso
        </Link>
        <Link href="/privacidade" className="text-sm text-white/55 transition hover:text-white">
          Privacidade
        </Link>
        <Link href="/cookies" className="text-sm text-white/55 transition hover:text-white">
          Cookies
        </Link>
      </nav>
    )
  }

  return (
    <nav aria-label="Documentos legais" className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <Link href="/termos" className="text-[11px] text-muted-foreground transition hover:text-foreground">
        Termos
      </Link>
      <Link href="/privacidade" className="text-[11px] text-muted-foreground transition hover:text-foreground">
        Privacidade
      </Link>
      <Link href="/cookies" className="text-[11px] text-muted-foreground transition hover:text-foreground">
        Cookies
      </Link>
    </nav>
  )
}
