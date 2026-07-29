import { apiClient } from "@/lib/api-client"
import type { Institution, User } from "@/types"
import type { InstitutionNotificationSettings } from "@/types"

export interface AdminSettingsResponse {
  institution: Institution
  admin: User
}

export async function fetchAdminSettings() {
  const { data } = await apiClient.get<AdminSettingsResponse>("/api/admin/settings")
  return data
}

export async function updateInstitutionProfile(payload: {
  name: string
  contact_email?: string
  phone?: string
  address?: string
  description?: string
}) {
  const { data } = await apiClient.patch<{ message: string; institution: Institution }>(
    "/api/admin/settings/profile",
    payload,
  )
  return data
}

export async function updateInstitutionBranding(payload: {
  logo_url?: string | null
  primary_color?: string
  secondary_color?: string
  accent_color?: string
  theme_preset?: string
  reset_to_default?: boolean
}) {
  const { data } = await apiClient.patch<{ message: string; institution: Institution }>(
    "/api/admin/settings/branding",
    payload,
  )
  return data
}

export async function updateNotificationSettings(payload: Partial<InstitutionNotificationSettings>) {
  const { data } = await apiClient.patch<{ message: string; institution: Institution }>(
    "/api/admin/settings/notifications",
    payload,
  )
  return data
}

export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  const { data } = await apiClient.put<{ message: string }>("/api/admin/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  })
  return data
}
