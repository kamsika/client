/**
 * Institution tenant helpers (path-prefix routing on a single origin).
 * Shared by middleware, the API client, and React components.
 */

export const TENANT_HEADER = "x-tenant"
export const TENANT_COOKIE = "ahms_tenant"
/** @deprecated Path-based routing; kept for legacy links. */
export const TENANT_QUERY_PARAM = "tenant"
/** @deprecated Same-origin login no longer needs a fragment handoff. */
export const TENANT_HANDOFF_PARAM = "ahms_handoff"

/** First URL segment that is never an institution slug. */
export const RESERVED_TENANT_SLUGS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "superadmin",
  "super-admin",
  "dashboard",
  "auth",
  "login",
  "static",
  "assets",
  "cdn",
  "mail",
  "test",
  "staging",
  "preview",
  "localhost",
  "teacher",
  "student",
  "parent",
  "institutional-onboarding",
  "_next",
  "models",
])

/** App areas that live under /admin, /teacher, etc. without a tenant prefix. */
const APP_ROUTE_ROOTS = new Set(["admin", "teacher", "student", "parent"])

const NON_TENANT_HOST_SUFFIXES = [
  "vercel.app",
  "railway.app",
  "onrender.com",
  "netlify.app",
  "herokuapp.com",
  "ngrok.io",
  "ngrok-free.app",
]

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/

function rootDomains(): string[] {
  const raw = process.env.NEXT_PUBLIC_ROOT_DOMAIN || ""
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean)
}

export function normalizeSubdomain(value: string | null | undefined): string {
  const text = (value || "").trim().toLowerCase()
  if (!text) return ""
  return text.split("/")[0].split(":")[0]
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return ""
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ""
}

/** Map public tenant dashboard URL to the internal App Router path. */
export function resolveTenantRestPath(rest: string): string {
  if (rest === "/" || rest === "") return "/admin/dashboard"
  if (rest === "/dashboard") return "/admin/dashboard"
  return rest.startsWith("/") ? rest : `/${rest}`
}

/**
 * Parse `/{slug}/...` — returns the slug and the path after it (before rewrite).
 */
export function extractTenantFromPath(pathname: string): { tenant: string; rest: string } {
  const parts = pathname.split("/").filter(Boolean)
  if (parts.length === 0) return { tenant: "", rest: "/" }

  const first = normalizeSubdomain(parts[0])
  if (!first || RESERVED_TENANT_SLUGS.has(first)) {
    return { tenant: "", rest: pathname || "/" }
  }

  const tail = parts.slice(1)
  const rest = tail.length ? `/${tail.join("/")}` : "/"
  return { tenant: first, rest }
}

/** Remove a leading `/{tenant}` segment for nav matching and internal paths. */
export function stripTenantPrefix(pathname: string): string {
  const { tenant, rest } = extractTenantFromPath(pathname)
  if (!tenant) return pathname || "/"
  return resolveTenantRestPath(rest)
}

/** Prefix an app path with the institution slug: `/admin/fees` → `/nec/admin/fees`. */
export function withTenantPrefix(path: string, tenant?: string | null): string {
  const slug = normalizeSubdomain(tenant)
  if (!slug) return path.startsWith("/") ? path : `/${path}`

  const normalized = path.startsWith("/") ? path : `/${path}`
  const { tenant: existing } = extractTenantFromPath(normalized)
  if (existing === slug) return normalized
  if (existing) return normalized

  return normalized === "/" ? `/${slug}/dashboard` : `/${slug}${normalized}`
}

/** Legacy subdomain host parsing — used only to redirect old URLs to path form. */
export function extractSubdomain(host: string | null | undefined): string {
  const hostname = normalizeSubdomain(host)
  if (!hostname) return ""
  if (hostname === "localhost" || hostname === "127.0.0.1" || IPV4.test(hostname)) return ""

  if (hostname.endsWith(".localhost")) {
    const label = hostname.slice(0, -".localhost".length).split(".")[0]
    return RESERVED_TENANT_SLUGS.has(label) ? "" : label
  }

  for (const domain of rootDomains()) {
    if (hostname === domain) return ""
    if (hostname.endsWith(`.${domain}`)) {
      const parts = hostname.slice(0, -`.${domain}`.length).split(".")
      const label = parts[parts.length - 1]
      return RESERVED_TENANT_SLUGS.has(label) ? "" : label
    }
  }

  for (const suffix of NON_TENANT_HOST_SUFFIXES) {
    if (hostname === suffix || hostname.endsWith(`.${suffix}`)) return ""
  }

  const labels = hostname.split(".")
  if (labels.length < 3) return ""

  const label = labels[0]
  return RESERVED_TENANT_SLUGS.has(label) ? "" : label
}

/**
 * Active institution slug: URL prefix first, then cookie (set by middleware).
 */
export function getClientTenant(): string {
  if (typeof window === "undefined") return ""

  const fromPath = extractTenantFromPath(window.location.pathname).tenant
  if (fromPath) return fromPath

  const fromCookie = normalizeSubdomain(readCookie(TENANT_COOKIE))
  if (fromCookie && !RESERVED_TENANT_SLUGS.has(fromCookie)) return fromCookie

  const fromQuery = normalizeSubdomain(
    new URLSearchParams(window.location.search).get(TENANT_QUERY_PARAM),
  )
  if (fromQuery && !RESERVED_TENANT_SLUGS.has(fromQuery)) return fromQuery

  return ""
}

/** Public workspace URL for an institution on the same origin. */
export function buildTenantUrl(subdomain: string, path = "/dashboard"): string {
  const slug = normalizeSubdomain(subdomain)
  if (!slug) return ""
  const suffix = path.startsWith("/") ? path : `/${path}`
  return withTenantPrefix(suffix, slug)
}

/** Post-login destination on the shared origin (no cross-origin redirect). */
export function buildTenantRedirect(
  subdomain: string | null | undefined,
  path: string,
  _handoff?: string,
): string {
  const slug = normalizeSubdomain(subdomain)
  if (!slug) return path
  if (getClientTenant() === slug) return withTenantPrefix(path, slug)
  return withTenantPrefix(path, slug)
}

export function isPlatformPublicPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean)
  if (parts.length === 0) return true
  const root = parts[0].toLowerCase()
  return (
    root === "auth" ||
    root === "superadmin" ||
    root === "institutional-onboarding" ||
    root === "api" ||
    root === "_next"
  )
}

export function isUnprefixedAppPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean)
  if (parts.length === 0) return false
  return APP_ROUTE_ROOTS.has(parts[0].toLowerCase())
}

export function tenantAwarePath(path: string, tenant?: string | null): string {
  const slug = tenant ?? getClientTenant()
  return withTenantPrefix(path, slug)
}
