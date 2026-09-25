"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

const COOKIE_NOTICE_KEY = "lucrom:cookie-notice:v1"

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(COOKIE_NOTICE_KEY) !== "acknowledged")
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const acknowledge = () => {
    try {
      localStorage.setItem(COOKIE_NOTICE_KEY, "acknowledged")
    } catch {
      /* armazenamento bloqueado — só esconde nesta visita */
    }
    setVisible(false)
  }

  return (
    <aside
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-2xl rounded-2xl border border-border bg-card p-4 shadow-2xl md:inset-x-auto md:right-5 md:w-[560px]"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted-foreground">
          Usamos apenas cookies e armazenamento estritamente necessários para o funcionamento da Criatai.{" "}
          <Link href="/cookies" className="font-semibold text-primary hover:underline">
            Saiba mais
          </Link>
        </p>
        <button
          type="button"
          onClick={acknowledge}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
        >
          Entendi
        </button>
      </div>
    </aside>
  )
}
