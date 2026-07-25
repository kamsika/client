import { apiClient } from "@/lib/api-client"
import type { TeacherAttendanceOverview } from "@/types"

export async function getTeacherAttendance(params?: {
  date?: string
  classroomId?: number
}) {
  const { data } = await apiClient.get<TeacherAttendanceOverview>("/api/teacher/attendance", {
    params: {
      date: params?.date,
      classroomId: params?.classroomId,
    },
  })
  return data
}
