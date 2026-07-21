import { apiClient } from "@/lib/api-client"

export interface StudentFaceProfile {
  id: number
  registration_no: string
  full_name: string | null
  descriptor: number[] | null
  has_face_descriptor: boolean
}

export async function listFaceProfiles() {
  const { data } = await apiClient.get<{ profiles: StudentFaceProfile[] }>("/api/students/face-profiles")
  return data.profiles
}

export async function saveStudentFace(studentId: number, descriptor: number[]) {
  const { data } = await apiClient.put<{ student: unknown; message: string }>(
    `/api/students/${studentId}/face`,
    { descriptor },
  )
  return data
}
