"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { AuthProvider, useAuth } from "@/lib/auth/auth-context"
import { Sidebar } from "@/components/studio/layout/sidebar"
import { Topbar } from "@/components/studio/layout/topbar"

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isLoginPage = pathname === "/studio/login"

  useEffect(() => {
    if (loading) return
    if (!session && !isLoginPage) router.replace("/studio/login")
  }, [session, loading, isLoginPage, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (isLoginPage) return <>{children}</>
  if (!session) return null

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden pl-[184px]">
        <Topbar />
        <main className="flex-1 overflow-auto pt-14">
          <div className="h-full p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>{children}</AuthGuard>
    </AuthProvider>
  )
}
