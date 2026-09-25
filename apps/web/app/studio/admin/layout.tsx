import { RequirePlatformAdmin } from "@/lib/auth/require-platform-admin"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RequirePlatformAdmin>{children}</RequirePlatformAdmin>
}
