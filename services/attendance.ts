import { apiClient } from "@/lib/api-client"
import type { Attendance, AttendanceRecord, Classroom } from "@/types"

export async function markAttendanceByScan(
  registrationNo: string,
  classroomId: number,
  scannedAt: string,
) {
  const { data } = await apiClient.post<{ attendance: Attendance; delta_minutes: number }>(
    "/api/attendance/mark",
    {
      registration_no: registrationNo,
      classroom_id: classroomId,
      status: "Present",
      scanned_at: scannedAt,
    },
  )
  return data
}

export async function scanCenterAttendance(payload: {
  registrationNo?: string
  studentId?: number
  classroomId?: number
}) {
  const { data } = await apiClient.post<{ attendance: Attendance; delta_minutes: number }>(
    "/api/attendance/scan",
    {
      registration_no: payload.registrationNo,
      student_id: payload.studentId,
      classroom_id: payload.classroomId,
      status: "Present",
      scanned_at: new Date().toISOString(),
    },
  )
  return data
}

export async function getTodayCenterAttendance() {
  const { data } = await apiClient.get<{
    date: string
    institution_id: number
    count: number
    records: Attendance[]
  }>("/api/attendance/today")
  return data
}

export async function markAttendance(studentId: number, classroomId: number, status?: string) {
  const { data } = await apiClient.post<{ attendance: Attendance; delta_minutes: number }>(
    "/api/attendance/mark",
    { student_id: studentId, classroom_id: classroomId, status },
  )
  return data
}

export async function getClassroomAttendance(classroomId: number) {
  const { data } = await apiClient.get<{
    classroom: Classroom
    date: string
    records: AttendanceRecord[]
  }>(`/api/attendance/classroom/${classroomId}`)
  return data
}

export async function getStudentAttendance(studentId: number) {
  const { data } = await apiClient.get<{ student: unknown; attendance: Attendance[] }>(
    `/api/attendance/student/${studentId}`,
  )
  return data
}

export async function exportAttendancePdf(classroomId: number) {
  const response = await apiClient.get(`/api/attendance/classroom/${classroomId}/export/pdf`, {
    responseType: "blob",
  })
  return response.data as Blob
}
