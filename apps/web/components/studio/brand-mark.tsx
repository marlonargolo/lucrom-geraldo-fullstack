import { cn } from "@/lib/utils"

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <span className="font-display text-base font-bold leading-none">L</span>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success ring-2 ring-background" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-display text-sm font-bold tracking-tight text-foreground">
          LUCROM <span className="text-primary">Studio</span>
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Agência de IA
        </span>
      </div>
    </div>
  )
}
