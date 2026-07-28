import { apiClient } from "@/lib/api-client"

export interface StudentFaceProfile {
  id: number
  registration_no: string
  full_name: string | null
  descriptor: number[] | null
  has_face_descriptor: boolean
}

export interface FaceRecognizeResponse {
  matched: boolean
  status: string
  message?: string
  student_id?: number
  registration_no?: string
  full_name?: string
  grade?: string
  classroom_id?: number
  classroom_name?: string
  distance?: number
  confidence?: number
}

export async function listFaceProfiles() {
  try {
    const { data } = await apiClient.get<{ profiles: StudentFaceProfile[] }>("/api/faces/profiles")
    return data.profiles
  } catch {
    const { data } = await apiClient.get<{ profiles: StudentFaceProfile[] }>(
      "/api/students/face-profiles",
    )
    return data.profiles
  }
}

export async function saveStudentFace(studentId: number, descriptor: number[]) {
  return registerFaceEmbeddings(studentId, [descriptor], descriptor)
}

export async function registerFaceEmbeddings(
  studentId: number,
  embeddings: number[][],
  averaged?: number[],
) {
  const { data } = await apiClient.post<{ student: unknown; message: string }>("/api/faces/register", {
    studentId,
    embeddings,
    descriptor: averaged,
  })
  return data
}

export async function recognizeFace(descriptor: number[], threshold?: number) {
  const { data } = await apiClient.post<FaceRecognizeResponse>("/api/faces/recognize", {
    embedding: descriptor,
    descriptor,
    threshold,
  })
  return data
}

export async function getStudentFaceProfile(studentId: number) {
  const { data } = await apiClient.get<{
    student_id: number
    has_face: boolean
    descriptor: number[] | null
  }>(`/api/faces/student/${studentId}`)
  return data
}
