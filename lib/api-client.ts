import axios from "axios"

import { TENANT_HANDOFF_PARAM, TENANT_HEADER, getClientTenant } from "@/lib/tenant"

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()
const API_BASE_URL = (configuredApiUrl || "http://localhost:5000").replace(/\/+$/, "")

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Tenant travels with every request so the API can scope data by institution
    // without each caller having to pass it explicitly.
    const tenant = getClientTenant()
    if (tenant) {
      config.headers[TENANT_HEADER] = tenant
    }
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token")
      localStorage.removeItem("user")
      if (!window.location.pathname.startsWith("/auth")) {
        window.location.href = "/auth/login"
      }
    }
    return Promise.reject(error)
  }
)

export function getStoredUser<T>() {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem("user")
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function storeAuth(token: string, user: unknown) {
  localStorage.setItem("access_token", token)
  localStorage.setItem("user", JSON.stringify(user))
}

export function clearAuth() {
  localStorage.removeItem("access_token")
  localStorage.removeItem("user")
}

/**
 * Package the current session so it can travel to the institution's subdomain.
 * A subdomain is a separate origin with its own `localStorage`, so logging in on
 * the main domain would otherwise be lost on redirect.
 */
export function encodeAuthHandoff(token: string, user: unknown): string {
  const json = JSON.stringify({ token, user })
  const bytes = new TextEncoder().encode(json)
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")
  return encodeURIComponent(btoa(binary))
}

/**
 * Adopt a session handed over from the main domain, then scrub it from the URL.
 * Returns true when a session was adopted. Safe to call on every page load.
 */
export function consumeAuthHandoff(): boolean {
  if (typeof window === "undefined") return false

  const hash = window.location.hash
  const marker = `${TENANT_HANDOFF_PARAM}=`
  const index = hash.indexOf(marker)
  if (index === -1) return false

  const raw = hash.slice(index + marker.length).split("&")[0]

  try {
    const binary = atob(decodeURIComponent(raw))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const { token, user } = JSON.parse(new TextDecoder().decode(bytes))
    if (!token || !user) return false
    storeAuth(token, user)
    return true
  } catch {
    return false
  } finally {
    // Never leave a token sitting in the address bar or in history.
    window.history.replaceState(null, "", window.location.pathname + window.location.search)
  }
}

export function getDashboardPath(role: string): string {
  switch (role) {
    case "super_admin":
    case "institution_admin":
      return "/admin/dashboard"
    case "teacher":
      return "/teacher/dashboard"
    case "student":
      return "/student/dashboard"
    case "parent":
      return "/parent/dashboard"
    default:
      return "/auth/login"
  }
}
