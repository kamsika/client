import { NextResponse, type NextRequest } from "next/server"

import {
  TENANT_COOKIE,
  TENANT_HEADER,
  TENANT_QUERY_PARAM,
  extractSubdomain,
  normalizeSubdomain,
} from "@/lib/tenant"

/**
 * Detects the institution subdomain for every request and forwards it as the
 * `x-tenant` header plus a host-scoped cookie. Routing is untouched: pages and
 * APIs behave exactly as before, they simply gain tenant context.
 *
 * Supported forms:
 *   kks.example.com           (production)
 *   kks.localhost:3000        (development)
 *   localhost:3000?tenant=kks (fallback when wildcard localhost is unavailable)
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || ""
  const { pathname, searchParams } = request.nextUrl

  const fromHost = extractSubdomain(host)
  const fromQuery = searchParams.has(TENANT_QUERY_PARAM)
    ? normalizeSubdomain(searchParams.get(TENANT_QUERY_PARAM))
    : null
  const fromCookie = normalizeSubdomain(request.cookies.get(TENANT_COOKIE)?.value)

  // Super Admin is main-domain only, so a leftover fallback cookie must never
  // put it into tenant context. A real subdomain still wins, which keeps the
  // cross-tenant guards in charge there.
  const isSuperAdminArea = pathname === "/superadmin" || pathname.startsWith("/superadmin/")

  let tenant = ""
  if (fromHost) {
    tenant = fromHost
  } else if (isSuperAdminArea) {
    tenant = ""
  } else if (fromQuery !== null) {
    // An explicit `?tenant=` (including an empty value, which exits the tenant).
    tenant = fromQuery
  } else {
    // Sticky fallback: the query param only appears on the first navigation, so
    // the cookie is what keeps `localhost:3000` in tenant context afterwards.
    tenant = fromCookie
  }

  const requestHeaders = new Headers(request.headers)
  if (tenant) {
    requestHeaders.set(TENANT_HEADER, tenant)
  } else {
    requestHeaders.delete(TENANT_HEADER)
  }

  // A tenant host is an institution workspace, not the public marketing site.
  const response =
    tenant && pathname === "/"
      ? NextResponse.redirect(new URL("/admin/dashboard", request.url))
      : NextResponse.next({ request: { headers: requestHeaders } })

  // Host-scoped cookie: each subdomain keeps its own value, so tenants can never
  // read each other's context.
  if (tenant) {
    if (tenant !== fromCookie) {
      response.cookies.set(TENANT_COOKIE, tenant, {
        path: "/",
        sameSite: "lax",
      })
    }
  } else if (fromCookie) {
    response.cookies.delete(TENANT_COOKIE)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|models/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|json|woff|woff2|ttf|bin)$).*)",
  ],
}
