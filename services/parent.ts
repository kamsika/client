import { apiClient, storeAuth } from "@/lib/api-client"
import type { AuthResponse, ParentAttendanceResponse, Student } from "@/types"

export async function parentLogin(phoneNumber: string, password: string) {
  const { data } = await apiClient.post<AuthResponse>("/api/parent/login", {
    phone_number: phoneNumber.trim(),
    password,
  })
  storeAuth(data.access_token, data.user)
  return data
}

export async function getParentChildren() {
  const { data } = await apiClient.get<{ students: Student[] }>("/api/parent/children")
  return data.students
}

export async function getParentAttendance(params?: {
  studentId?: number
  month?: number
  year?: number
}) {
  const { data } = await apiClient.get<ParentAttendanceResponse>("/api/parent/attendance", {
    params: {
      student_id: params?.studentId,
      month: params?.month,
      year: params?.year,
    },
  })
  return data
}
