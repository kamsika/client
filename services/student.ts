import { apiClient } from "@/lib/api-client"
import type { Student, User } from "@/types"

export interface CreateStudentInput {
  full_name: string
  grade: string
  section: string
  gender: "Male" | "Female" | "Other"
  contact: string
  enrolledSubjects?: string[]
}

export interface UpdateStudentInput {
  full_name?: string
  grade?: string
  section?: string
  gender?: "Male" | "Female" | "Other" | null
  contact?: string
  enrolledSubjects?: string[]
}

export async function createStudent(input: CreateStudentInput) {
  const { data } = await apiClient.post<{ student: Student; message: string }>("/api/students", {
    ...input,
    enrolledSubjects: input.enrolledSubjects ?? [],
  })
  return data
}

export async function updateStudent(studentId: number, input: UpdateStudentInput) {
  const { data } = await apiClient.patch<{ student: Student; message: string }>(
    `/api/students/${studentId}`,
    input,
  )
  return data
}

export async function updateStudentSubjects(studentId: number, enrolledSubjects: string[]) {
  const { data } = await apiClient.put<{
    success: boolean
    student: Student
    enrolledSubjects: string[]
    message: string
  }>(`/api/students/${studentId}/subjects`, { enrolledSubjects })
  return data
}

export async function updateStudentPaymentStatus(
  studentId: number,
  paymentStatus: "Pending" | "Paid" | "Overdue",
  billingPeriod?: string,
) {
  const { data } = await apiClient.patch<{
    success: boolean
    payment: {
      billing_period: string
      payment_status: "Pending" | "Paid" | "Overdue"
      amount_due: number | null
      paid_at: string | null
    }
  }>(`/api/students/${studentId}/payment-status`, {
    paymentStatus,
    billingPeriod,
  })
  return data.payment
}

export async function listStudents(searchOrOptions?: string | { search?: string; grade?: string }) {
  const search =
    typeof searchOrOptions === "string" ? searchOrOptions : searchOrOptions?.search
  const grade = typeof searchOrOptions === "string" ? undefined : searchOrOptions?.grade

  const { data } = await apiClient.get<{
    students: Student[]
    count?: number
    search?: string | null
    grade?: string | null
    grades?: string[]
  }>("/api/students", {
    params: {
      ...(search?.trim() ? { search: search.trim() } : {}),
      ...(grade?.trim() && grade.trim().toLowerCase() !== "all"
        ? { grade: grade.trim() }
        : {}),
    },
  })
  return data.students
}

export async function listStudentGrades() {
  const { data } = await apiClient.get<{ grades?: string[] }>("/api/students")
  return data.grades ?? []
}

export async function searchStudents(query: string) {
  const { data } = await apiClient.get<{ students: Student[]; count?: number; search?: string | null }>(
    "/api/students",
    {
      params: { search: query.trim() },
    },
  )
  return data
}

export async function listTeachers() {
  const { data } = await apiClient.get<{ teachers: User[] }>("/api/students/teachers")
  return data.teachers
}

export async function getMyChildren() {
  const { data } = await apiClient.get<{ students: Student[] }>("/api/students/my-children")
  return data.students
}

export async function importStudents(file: File) {
  const formData = new FormData()
  formData.append("file", file)
  const { data } = await apiClient.post<{ created: string[]; errors: string[]; count: number }>(
    "/api/students/import",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  )
  return data
}

export async function downloadImportTemplate() {
  const response = await apiClient.get("/api/students/import/template", { responseType: "blob" })
  return response.data as Blob
}
