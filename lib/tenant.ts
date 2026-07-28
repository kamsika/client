/**
 * Tenant (institution subdomain) helpers shared by middleware, the API client,
 * and React components. Must stay free of React/Node-only imports so it can run
 * in the Edge middleware runtime.
 */

export const TENANT_HEADER = "x-tenant"
export const TENANT_COOKIE = "ahms_tenant"
export const TENANT_QUERY_PARAM = "tenant"
/**
 * Fragment key used to hand the session to a tenant subdomain after login.
 * A subdomain is a separate origin, so `localStorage` does not travel with the
 * redirect. The fragment is never sent to a server and is stripped on arrival.
 */
export const TENANT_HANDOFF_PARAM = "ahms_handoff"

/** Labels that address the platform itself, never an institution. */
const RESERVED_SUBDOMAINS = new Set([
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
])

/** Hosts whose first label is a deployment id (not a tenant). */
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

/** Extract the institution subdomain from a Host header. Returns "" when none. */
export function extractSubdomain(host: string | null | undefined): string {
  const hostname = normalizeSubdomain(host)
  if (!hostname) return ""
  if (hostname === "localhost" || hostname === "127.0.0.1" || IPV4.test(hostname)) return ""

  // Local development: abc.localhost:3000
  if (hostname.endsWith(".localhost")) {
    const label = hostname.slice(0, -".localhost".length).split(".")[0]
    return RESERVED_SUBDOMAINS.has(label) ? "" : label
  }

  for (const domain of rootDomains()) {
    if (hostname === domain) return ""
    if (hostname.endsWith(`.${domain}`)) {
      const parts = hostname.slice(0, -`.${domain}`.length).split(".")
      const label = parts[parts.length - 1]
      return RESERVED_SUBDOMAINS.has(label) ? "" : label
    }
  }

  for (const suffix of NON_TENANT_HOST_SUFFIXES) {
    if (hostname === suffix || hostname.endsWith(`.${suffix}`)) return ""
  }

  const labels = hostname.split(".")
  if (labels.length < 3) return ""

  const label = labels[0]
  return RESERVED_SUBDOMAINS.has(label) ? "" : label
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return ""
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ""
}

/**
 * Current tenant slug in the browser: Host -> cookie (set by middleware) ->
 * ?tenant= fallback for environments without wildcard localhost subdomains.
 */
export function getClientTenant(): string {
  if (typeof window === "undefined") return ""

  const fromHost = extractSubdomain(window.location.host)
  if (fromHost) return fromHost

  const fromQuery = normalizeSubdomain(
    new URLSearchParams(window.location.search).get(TENANT_QUERY_PARAM),
  )
  if (fromQuery && !RESERVED_SUBDOMAINS.has(fromQuery)) return fromQuery

  const fromCookie = normalizeSubdomain(readCookie(TENANT_COOKIE))
  if (fromCookie && !RESERVED_SUBDOMAINS.has(fromCookie)) return fromCookie

  return ""
}

/**
 * Public URL for an institution: `https://kks.example.com/admin/dashboard` in
 * production, `http://kks.localhost:3000/admin/dashboard` in development.
 *
 * Returns "" when the current environment cannot host subdomains, which lets
 * callers fall back to the `?tenant=` form instead of inventing a broken host.
 */
export function buildTenantUrl(subdomain: string, path = "/"): string {
  const slug = normalizeSubdomain(subdomain)
  if (!slug) return ""

  const suffix = path.startsWith("/") ? path : `/${path}`

  const [root] = rootDomains()
  if (root) return `https://${slug}.${root}${suffix}`

  if (typeof window !== "undefined") {
    const { protocol, host } = window.location
    const hostname = host.split(":")[0]
    const port = host.split(":")[1]
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      return `${protocol}//${slug}.localhost${port ? `:${port}` : ""}${suffix}`
    }
  }

  return ""
}

/**
 * Where a user should land after logging in.
 *
 * On the institution's own subdomain (or when subdomains are unavailable) this
 * is just the relative dashboard path, so nothing changes for existing setups.
 * From the main domain it becomes an absolute URL on the institution's
 * subdomain, carrying the session in the URL fragment.
 */
export function buildTenantRedirect(
  subdomain: string | null | undefined,
  path: string,
  handoff?: string,
): string {
  const slug = normalizeSubdomain(subdomain)
  if (!slug) return path

  // Already on the right tenant: keep the plain client-side navigation.
  if (getClientTenant() === slug) return path

  const url = buildTenantUrl(slug, path)
  if (!url) {
    // No wildcard host available (e.g. an IP or a bare custom domain): use the
    // documented development fallback instead of failing the redirect.
    const separator = path.includes("?") ? "&" : "?"
    return `${path}${separator}${TENANT_QUERY_PARAM}=${encodeURIComponent(slug)}`
  }

  return handoff ? `${url}#${TENANT_HANDOFF_PARAM}=${handoff}` : url
}
