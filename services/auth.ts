import {
  apiClient,
  clearAuth,
  encodeAuthHandoff,
  getDashboardPath,
  storeAuth,
} from "@/lib/api-client"
import { buildTenantRedirect } from "@/lib/tenant"
import type { AuthResponse, User } from "@/types"

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<AuthResponse>("/api/auth/login", {
    email: email.trim().toLowerCase(),
    password,
  })
  storeAuth(data.access_token, data.user)
  return data
}

export async function fetchCurrentUser() {
  const { data } = await apiClient.get<{ user: User }>("/api/auth/me")
  storeAuth(localStorage.getItem("access_token") || "", data.user)
  return data.user
}

export function logout() {
  clearAuth()
  window.location.href = "/auth/login"
}

export function redirectByRole(role: string) {
  window.location.href = getDashboardPath(role)
}

/**
 * Destination after a successful login.
 *
 * Institution users are sent to their own subdomain
 * (`https://kks.example.com/admin/dashboard`), carrying the session across the
 * origin boundary. Super Admins stay on the main domain, and anyone already on
 * the correct subdomain just navigates client-side as before.
 */
export function resolveLoginRedirect(auth: AuthResponse): {
  url: string
  crossOrigin: boolean
} {
  const path = getDashboardPath(auth.user.role)

  if (auth.user.role === "super_admin") {
    return { url: path, crossOrigin: false }
  }

  const subdomain = auth.user.institution?.subdomain
  if (!subdomain) {
    return { url: path, crossOrigin: false }
  }

  const handoff = encodeAuthHandoff(auth.access_token, auth.user)
  const url = buildTenantRedirect(subdomain, path, handoff)

  return { url, crossOrigin: url.startsWith("http") }
}

export async function registerInstitution(payload: {
  name: string
  subdomain: string
  admin_name: string
  admin_email: string
  admin_password: string
  admin_phone?: string
}) {
  const { data } = await apiClient.post("/api/auth/register-institution", payload)
  return data
}

export async function registerUser(payload: {
  role: string
  email: string
  password: string
  full_name: string
  phone_number?: string
  institution_id?: number
}) {
  const { data } = await apiClient.post<{ user: User }>("/api/auth/register", payload)
  return data
}
