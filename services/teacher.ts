import { apiClient } from "@/lib/api-client"
import { downloadBlob } from "@/lib/download"
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

function exportParams(params?: {
  date?: string
  classroomId?: number
  grade?: string
  subject?: string
  search?: string
}) {
  return {
    date: params?.date,
    classroomId: params?.classroomId,
    grade: params?.grade && params.grade !== "All" ? params.grade : undefined,
    subject: params?.subject && params.subject !== "All" ? params.subject : undefined,
    search: params?.search?.trim() || undefined,
  }
}

export async function exportTeacherAttendanceCsv(params?: {
  date?: string
  classroomId?: number
  grade?: string
  subject?: string
  search?: string
}) {
  const response = await apiClient.get("/api/teacher/attendance/export/csv", {
    params: exportParams(params),
    responseType: "blob",
  })
  const blob = response.data as Blob
  const date = params?.date || "attendance"
  await downloadBlob(blob, `attendance_history_${date}.csv`)
}

export async function exportTeacherAttendancePdf(params?: {
  date?: string
  classroomId?: number
  grade?: string
  subject?: string
  search?: string
}) {
  const response = await apiClient.get("/api/teacher/attendance/export/pdf", {
    params: exportParams(params),
    responseType: "blob",
  })
  const blob = response.data as Blob
  const date = params?.date || "attendance"
  await downloadBlob(blob, `attendance_history_${date}.pdf`)
}
