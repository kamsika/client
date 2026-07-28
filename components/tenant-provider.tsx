"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

import { TenantStatusScreen } from "@/components/tenant-status-screen"
import { consumeAuthHandoff } from "@/lib/api-client"
import { getClientTenant } from "@/lib/tenant"
import { resolveTenant, type TenantResolution } from "@/services/tenant"
import type { Institution } from "@/types"

interface TenantContextValue {
  /** Current subdomain, or "" on the main domain. */
  subdomain: string
  institution: Institution | null
  institutionId: number | null
  institutionName: string | null
  /** True while the subdomain is being resolved. */
  loading: boolean
  /** True on the main domain (Super Admin / legacy single-domain access). */
  isMainDomain: boolean
}

const TenantContext = createContext<TenantContextValue>({
  subdomain: "",
  institution: null,
  institutionId: null,
  institutionName: null,
  loading: false,
  isMainDomain: true,
})

/** Institution context for the current subdomain. Safe to call anywhere. */
export function useTenant() {
  return useContext(TenantContext)
}

/**
 * Resolves the active institution from the subdomain and exposes it to the app.
 *
 * On the main domain this is a no-op pass-through, so every existing page keeps
 * working unchanged. On a tenant subdomain it blocks rendering only for unknown
 * or suspended institutions.
 */
// Runs as the client bundle loads, before any dashboard route guard reads the
// session, so an admin arriving from the main domain is already authenticated.
consumeAuthHandoff()

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [subdomain, setSubdomain] = useState("")
  const [resolution, setResolution] = useState<TenantResolution | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const slug = getClientTenant()
    setSubdomain(slug)

    if (!slug) {
      setResolution(null)
      return
    }

    let cancelled = false
    setLoading(true)

    void resolveTenant(slug)
      .then((result) => {
        if (!cancelled) setResolution(result)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<TenantContextValue>(() => {
    const institution = resolution?.institution ?? null
    return {
      subdomain,
      institution,
      institutionId: institution?.id ?? null,
      institutionName: institution?.name ?? institution?.institution_name ?? null,
      loading,
      isMainDomain: !subdomain,
    }
  }, [resolution, subdomain, loading])

  // Unknown / suspended subdomains get a dedicated page instead of the app.
  if (resolution?.status === "not_found") {
    return <TenantStatusScreen variant="not_found" subdomain={subdomain} />
  }
  if (resolution?.status === "suspended") {
    return (
      <TenantStatusScreen
        variant="suspended"
        subdomain={subdomain}
        institutionName={resolution.institution?.name}
      />
    )
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}
