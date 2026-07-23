"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { getDashboardPath, getStoredUser } from "@/lib/api-client"
import type { User } from "@/types"

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const user = getStoredUser<User>()
    if (!user) {
      router.replace("/auth/login")
      return
    }

    if (user.role !== "teacher") {
      router.replace(getDashboardPath(user.role))
    }
  }, [pathname, router])

  return children
}
