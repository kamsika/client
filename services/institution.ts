import { apiClient } from "@/lib/api-client"
import type { BillingRecord, Institution, User } from "@/types"

export interface InstitutionAdminCredentials {
  email: string
  password: string
  full_name: string
  role: "institution_admin"
  institution_id: number
}

export interface CreateInstitutionResponse {
  institution: Institution
  admin: User
  admin_credentials: InstitutionAdminCredentials
}

export async function listInstitutions() {
  const { data } = await apiClient.get<{ institutions: Institution[] }>("/api/institutions")
  return data.institutions
}

export async function createInstitution(payload: {
  name: string
  subdomain: string
  admin_name?: string
  admin_email?: string
  admin_phone?: string
}) {
  const { data } = await apiClient.post<CreateInstitutionResponse>("/api/institutions", payload)
  return data
}
export async function updateInstitutionStatus(id: number, status: "Active" | "Suspended") {
  const { data } = await apiClient.patch<{ institution: Institution }>(`/api/institutions/${id}/status`, { status })
  return data.institution
}

export async function getBilling(institutionId: number) {
  const { data } = await apiClient.get<{ billing_records: BillingRecord[] }>(`/api/institutions/${institutionId}/billing`)
  return data.billing_records
}
