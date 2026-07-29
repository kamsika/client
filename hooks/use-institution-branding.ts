"use client"

import { useEffect, useMemo, useState } from "react"

import { useTenant } from "@/components/tenant-provider"
import {
  brandingCssVariables,
  brandingFromInstitution,
  readCachedBranding,
  type InstitutionBranding,
} from "@/lib/institution-branding"
import { getStoredUser } from "@/lib/api-client"
import type { User } from "@/types"

export function useInstitutionBranding(): InstitutionBranding {
  const tenant = useTenant()
  const [cached, setCached] = useState<InstitutionBranding | null>(null)

  const institutionId =
    tenant.institutionId ?? getStoredUser<User>()?.institution_id ?? null

  useEffect(() => {
    if (!institutionId) {
      setCached(null)
      return
    }
    setCached(readCachedBranding(institutionId))

    function onBrandingUpdated(event: Event) {
      const detail = (event as CustomEvent<{ institutionId: number }>).detail
      if (detail?.institutionId === institutionId) {
        setCached(readCachedBranding(institutionId))
      }
    }
    window.addEventListener("ahms-branding-updated", onBrandingUpdated)
    return () => window.removeEventListener("ahms-branding-updated", onBrandingUpdated)
  }, [institutionId])

  return useMemo(() => {
    const fromTenant = brandingFromInstitution(tenant.institution)
    if (tenant.institution?.primary_color) {
      return fromTenant
    }
    if (cached) {
      return cached
    }
    const user = getStoredUser<User>()
    if (user?.institution) {
      return brandingFromInstitution(user.institution)
    }
    return fromTenant
  }, [tenant.institution, cached])
}

export function useInstitutionBrandingStyle() {
  const branding = useInstitutionBranding()
  return brandingCssVariables(branding)
}
