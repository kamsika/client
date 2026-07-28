import { NextResponse, type NextRequest } from "next/server"

import {
  TENANT_COOKIE,
  TENANT_HEADER,
  extractSubdomain,
  extractTenantFromPath,
  isPlatformPublicPath,
  isUnprefixedAppPath,
  normalizeSubdomain,
  resolveTenantRestPath,
  withTenantPrefix,
} from "@/lib/tenant"

/**
 * Path-based multi-tenancy on one origin:
 *   /auth/login              — public login
 *   /nec/dashboard           — institution workspace (rewritten internally)
 *   /nec/admin/students/...  — all institution routes under /{slug}/...
 *
 * Legacy `{slug}.localhost` hosts redirect to `localhost:PORT/{slug}/...`.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || ""
  const { pathname, searchParams } = request.nextUrl

  const legacySubdomain = extractSubdomain(host)
  if (legacySubdomain) {
    const url = request.nextUrl.clone()
    const hostParts = url.host.split(":")
    if (hostParts.length > 1) {
      url.port = hostParts[1]
    }
    url.hostname = "localhost"
    const suffix =
      pathname === "/" ? `/${legacySubdomain}/dashboard` : `/${legacySubdomain}${pathname}`
    url.pathname = suffix
    return NextResponse.redirect(url)
  }

  const fromCookie = normalizeSubdomain(request.cookies.get(TENANT_COOKIE)?.value)
  const isSuperAdminArea = pathname === "/superadmin" || pathname.startsWith("/superadmin/")
  const isPublic = isPlatformPublicPath(pathname)

  const { tenant: pathTenant, rest } = extractTenantFromPath(pathname)

  if (pathTenant && rest === "/") {
    const url = request.nextUrl.clone()
    url.pathname = `/${pathTenant}/dashboard`
    return NextResponse.redirect(url)
  }

  if (!pathTenant && !isPublic && !isSuperAdminArea && isUnprefixedAppPath(pathname) && fromCookie) {
    const url = request.nextUrl.clone()
    url.pathname = withTenantPrefix(pathname, fromCookie)
    return NextResponse.redirect(url)
  }

  let tenant = ""
  if (pathTenant) {
    tenant = pathTenant
  } else if (isSuperAdminArea || isPublic) {
    tenant = ""
  } else if (searchParams.has("tenant")) {
    tenant = normalizeSubdomain(searchParams.get("tenant"))
  } else {
    tenant = fromCookie
  }

  const requestHeaders = new Headers(request.headers)
  if (tenant) {
    requestHeaders.set(TENANT_HEADER, tenant)
  } else {
    requestHeaders.delete(TENANT_HEADER)
  }

  let response: NextResponse

  if (pathTenant) {
    const internalPath = resolveTenantRestPath(rest)
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = internalPath
    response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (tenant) {
    if (tenant !== fromCookie) {
      response.cookies.set(TENANT_COOKIE, tenant, {
        path: "/",
        sameSite: "lax",
      })
    }
  } else if (fromCookie && (isPublic || isSuperAdminArea)) {
    response.cookies.delete(TENANT_COOKIE)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|models/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|json|woff|woff2|ttf|bin)$).*)",
  ],
}
