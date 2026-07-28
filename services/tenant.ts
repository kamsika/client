import axios from "axios"

import { apiClient } from "@/lib/api-client"
import type { Institution } from "@/types"

export type TenantStatus = "none" | "active" | "not_found" | "suspended" | "error"

export interface TenantResolution {
  status: TenantStatus
  subdomain: string
  institution: Institution | null
}

interface TenantResolveResponse {
  tenant: Institution | null
  subdomain: string | null
  code?: string
  errors?: string[]
}

/**
 * Resolve a subdomain to its institution. The backend also infers the tenant
 * from Host / X-Tenant, so `subdomain` is only a hint for the query fallback.
 */
export async function resolveTenant(subdomain?: string): Promise<TenantResolution> {
  const slug = (subdomain || "").trim().toLowerCase()

  try {
    const { data } = await apiClient.get<TenantResolveResponse>("/api/tenant/resolve", {
      params: slug ? { subdomain: slug } : undefined,
    })

    if (!data.tenant) {
      return { status: "none", subdomain: data.subdomain || slug, institution: null }
    }
    return {
      status: "active",
      subdomain: data.tenant.subdomain,
      institution: data.tenant,
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const payload = error.response?.data as TenantResolveResponse | undefined
      if (error.response?.status === 404 || payload?.code === "institution_not_found") {
        return { status: "not_found", subdomain: slug, institution: null }
      }
      if (error.response?.status === 403 || payload?.code === "institution_suspended") {
        return {
          status: "suspended",
          subdomain: payload?.tenant?.subdomain || slug,
          institution: payload?.tenant ?? null,
        }
      }
    }
    return { status: "error", subdomain: slug, institution: null }
  }
}
