import axios from "axios"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

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
