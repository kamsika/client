"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { getStoredUser } from "@/lib/api-client"
import type { User } from "@/types"

export default function InstitutionalOnboardingPage() {
  const router = useRouter()

  useEffect(() => {
    const user = getStoredUser<User>()
    if (user?.role === "super_admin") {
      router.replace("/admin/dashboard")
    } else {
      router.replace("/auth/login")
    }
  }, [router])

  return null
}
