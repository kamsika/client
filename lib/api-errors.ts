import axios from "axios"

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { errors?: string[]; message?: string } | undefined
    if (data?.errors?.length) return data.errors[0]
    if (data?.message) return data.message
    if (error.response?.status === 401) return "Invalid email or password"
    if (error.response?.status === 403) return "Access denied"
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function isAlreadyScannedError(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return false
  const data = error.response.data as
    | { already_scanned?: boolean; errors?: string[] }
    | undefined
  if (data?.already_scanned) return true
  return Boolean(data?.errors?.some((msg) => /already scanned/i.test(msg)))
}
