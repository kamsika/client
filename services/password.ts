import { apiClient } from "@/lib/api-client"
import type { Institution, User } from "@/types"

export interface InstitutionDetailResponse {
  institution: Institution
  admin: User | null
}

export async function getSuperAdminInstitution(institutionId: number) {
  const { data } = await apiClient.get<InstitutionDetailResponse>(
    `/api/super-admin/institutions/${institutionId}`,
  )
  return data
}

export async function changeInstitutionAdminPassword(institutionId: number, newPassword: string) {
  const { data } = await apiClient.put<{ message: string; admin: User }>(
    `/api/super-admin/institutions/${institutionId}/change-admin-password`,
    { new_password: newPassword },
  )
  return data
}
