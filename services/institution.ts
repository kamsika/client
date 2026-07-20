import { apiClient } from "@/lib/api-client"
import type { BillingRecord, Institution } from "@/types"

export async function listInstitutions() {
  const { data } = await apiClient.get<{ institutions: Institution[] }>("/api/institutions")
  return data.institutions
}

export async function createInstitution(payload: { name: string; subdomain: string }) {
  const { data } = await apiClient.post<{ institution: Institution }>("/api/institutions", payload)
  return data.institution
}

export async function updateInstitutionStatus(id: number, status: "Active" | "Suspended") {
  const { data } = await apiClient.patch<{ institution: Institution }>(`/api/institutions/${id}/status`, { status })
  return data.institution
}

export async function getBilling(institutionId: number) {
  const { data } = await apiClient.get<{ billing_records: BillingRecord[] }>(`/api/institutions/${institutionId}/billing`)
  return data.billing_records
}
