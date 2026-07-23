import { apiClient, clearAuth, getDashboardPath, storeAuth } from "@/lib/api-client"
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
