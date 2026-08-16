"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

export interface FaqItem {
  question: string
  answer: string
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-card">
      {items.map((item, i) => {
        const open = openIndex === i
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
              aria-expanded={open}
            >
              <span className="text-sm font-medium text-foreground">{item.question}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${
                  open ? "rotate-180 text-primary" : ""
                }`}
                aria-hidden
              />
            </button>
            {open && (
              <div className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground sm:px-5">{item.answer}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
