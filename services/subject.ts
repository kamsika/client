import { apiClient } from "@/lib/api-client"
import type { Subject } from "@/types"

export async function listSubjects() {
  const { data } = await apiClient.get<{ subjects: Subject[] }>("/api/subjects")
  return data.subjects
}

export async function createSubject(payload: {
  name: string
  code?: string
  teacher_id?: number
}) {
  const { data } = await apiClient.post<{ subject: Subject }>("/api/subjects", payload)
  return data.subject
}
