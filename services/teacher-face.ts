import { apiClient } from "@/lib/api-client"
import type { Student } from "@/types"

export type TeacherFaceStatus = {
  student_id: number
  studentId?: number
  registration_no?: string
  full_name?: string | null
  has_face: boolean
  face_status: "Registered" | "Not Registered" | string
  faceStatus?: string
  institution_id?: number
  registered_by?: number | null
  registration_date?: string | null
  registrationDate?: string | null
  updated_at?: string | null
  updatedAt?: string | null
  student?: Student
}

export async function getTeacherStudentFaceStatus(studentId: number) {
  const { data } = await apiClient.get<TeacherFaceStatus>(
    `/api/teacher/students/${studentId}/face-status`,
  )
  return data
}

export async function registerTeacherStudentFace(
  studentId: number,
  embeddings: number[][],
  averaged?: number[],
) {
  const { data } = await apiClient.post<TeacherFaceStatus & { success: boolean; message: string }>(
    `/api/teacher/students/${studentId}/register-face`,
    {
      embeddings,
      samples: embeddings,
      descriptor: averaged,
      face_embedding: averaged,
    },
  )
  return data
}

export async function updateTeacherStudentFace(
  studentId: number,
  embeddings: number[][],
  averaged?: number[],
) {
  const { data } = await apiClient.put<TeacherFaceStatus & { success: boolean; message: string }>(
    `/api/teacher/students/${studentId}/update-face`,
    {
      embeddings,
      samples: embeddings,
      descriptor: averaged,
      face_embedding: averaged,
    },
  )
  return data
}

export async function deleteTeacherStudentFace(studentId: number) {
  const { data } = await apiClient.delete<TeacherFaceStatus & { success: boolean; message: string }>(
    `/api/teacher/students/${studentId}/delete-face`,
  )
  return data
}
