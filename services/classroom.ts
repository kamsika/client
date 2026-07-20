import { apiClient } from "@/lib/api-client"
import type { Classroom } from "@/types"

export async function listClassrooms() {
  const { data } = await apiClient.get<{ classrooms: Classroom[] }>("/api/classrooms")
  return data.classrooms
}

export async function createClassroom(payload: {
  name: string
  schedule_start_time: string
  teacher_id: number
}) {
  const { data } = await apiClient.post<{ classroom: Classroom }>("/api/classrooms", payload)
  return data.classroom
}
