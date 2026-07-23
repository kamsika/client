"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { getDashboardPath, getStoredUser } from "@/lib/api-client"
import type { User } from "@/types"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const user = getStoredUser<User>()
    if (!user) {
      router.replace("/auth/login")
      return
    }

    // Teachers and other non-admin roles cannot access /admin routes.
    if (user.role !== "super_admin" && user.role !== "institution_admin") {
      router.replace(getDashboardPath(user.role))
    }
  }, [pathname, router])

  return children
}
