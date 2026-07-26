import { apiClient } from "@/lib/api-client"
import type { TeacherAttendanceOverview } from "@/types"

export async function getTeacherAttendance(params?: {
  date?: string
  classroomId?: number
  grade?: string
  subject?: string
  search?: string
}) {
  const { data } = await apiClient.get<TeacherAttendanceOverview>("/api/teacher/attendance", {
    params: {
      date: params?.date,
      classroomId: params?.classroomId,
      grade: params?.grade && params.grade !== "All" ? params.grade : undefined,
      subject:
        params?.subject && params.subject !== "All" ? params.subject : undefined,
      search: params?.search?.trim() || undefined,
    },
  })
  return data
}
