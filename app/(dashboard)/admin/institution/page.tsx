"use client"

import { AdminInstitutionPage } from "@/components/admin-settings/admin-institution-page"
import { SuperAdminInstitutionsPage } from "@/components/super-admin-institutions-page"
import { getStoredUser } from "@/lib/api-client"
import type { User } from "@/types"

export default function InstitutionPage() {
  const user = getStoredUser<User>()
  if (user?.role === "super_admin") {
    return <SuperAdminInstitutionsPage />
  }
  return <AdminInstitutionPage />
}
