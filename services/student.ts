import { apiClient } from "@/lib/api-client"
import type { Student, User } from "@/types"

export async function listStudents() {
  const { data } = await apiClient.get<{ students: Student[] }>("/api/students")
  return data.students
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
    { headers: { "Content-Type": "multipart/form-data" } }
  )
  return data
}

export async function downloadImportTemplate() {
  const response = await apiClient.get("/api/students/import/template", { responseType: "blob" })
  return response.data as Blob
}
