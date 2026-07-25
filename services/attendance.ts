import { apiClient } from "@/lib/api-client"
import type {
  Attendance,
  AttendanceReportResponse,
  ClassroomAttendanceResponse,
  StudentAttendanceHistoryResponse,
} from "@/types"

export async function markAttendanceByScan(
  scannedStudentId: string,
  classroomId: number,
  scannedAt: string,
) {
  console.log("Sending student ID to API:", scannedStudentId)
  const { data } = await apiClient.post<{ attendance: Attendance; delta_minutes: number }>(
    "/api/attendance/mark",
    {
      student_id: scannedStudentId,
      classroom_id: classroomId,
      status: "Present",
      scanned_at: scannedAt,
      prevent_duplicate: true,
    },
  )
  return data
}

export async function scanCenterAttendance(payload: {
  scannedStudentId: string
  classroomId?: number
}) {
  console.log("Sending student ID to API:", payload.scannedStudentId)
  const { data } = await apiClient.post<{ attendance: Attendance; delta_minutes: number }>(
    "/api/attendance/scan",
    {
      student_id: payload.scannedStudentId,
      classroom_id: payload.classroomId,
      status: "Present",
      scanned_at: new Date().toISOString(),
      prevent_duplicate: true,
    },
  )
  return data
}

export async function getCenterAttendance(params?: {
  date?: string
  classroomId?: number
}) {
  const { data } = await apiClient.get<{
    date: string
    institution_id: number | null
    classroom_id: number | null
    count: number
    records: Attendance[]
  }>("/api/attendance/today", {
    params: {
      date: params?.date,
      classroom_id: params?.classroomId,
    },
  })
  return data
}

/** @deprecated Prefer getCenterAttendance({ date }) */
export async function getTodayCenterAttendance(date?: string) {
  return getCenterAttendance({ date })
}

export async function markAttendance(studentId: number, classroomId: number, status?: string) {
  const { data } = await apiClient.post<{ attendance: Attendance; delta_minutes: number }>(
    "/api/attendance/mark",
    { student_id: studentId, classroom_id: classroomId, status },
  )
  return data
}

/** Kiosk / face scan mark — includes client timestamp and skips same-day duplicates. */
export async function markKioskAttendance(payload: {
  studentId: number
  classroomId: number
  timestamp?: string
}) {
  const { data } = await apiClient.post<{
    success: true
    status: "Present"
    message: string
    data: Attendance
    attendance: Attendance
  }>(
    "/api/attendance",
    {
      studentId: payload.studentId,
      classroomId: payload.classroomId,
      status: "Present",
      timestamp: payload.timestamp ?? new Date().toISOString(),
    },
  )
  return data
}

export async function getClassroomAttendance(classroomId: number, date?: string) {
  const { data } = await apiClient.get<ClassroomAttendanceResponse>(
    `/api/attendance/classroom/${classroomId}`,
    {
      params: date ? { date } : undefined,
    },
  )
  return data
}

export async function getStudentAttendance(
  studentId: number,
  params?: {
    classroomId?: number
    startDate?: string
    endDate?: string
  },
) {
  const { data } = await apiClient.get<StudentAttendanceHistoryResponse>(
    `/api/attendance/student/${studentId}`,
    {
      params: {
        classroom_id: params?.classroomId,
        start_date: params?.startDate,
        end_date: params?.endDate,
      },
    },
  )
  return data
}

export async function getAttendanceReport(params: {
  classroomId: number
  startDate: string
  endDate: string
}) {
  const { data } = await apiClient.get<AttendanceReportResponse>("/api/attendance/report", {
    params: {
      classroom_id: params.classroomId,
      start_date: params.startDate,
      end_date: params.endDate,
    },
  })
  return data
}

export async function exportAttendanceReportCsv(params: {
  classroomId: number
  startDate: string
  endDate: string
}) {
  const response = await apiClient.get("/api/attendance/report/export/csv", {
    responseType: "blob",
    params: {
      classroom_id: params.classroomId,
      start_date: params.startDate,
      end_date: params.endDate,
    },
  })
  return response.data as Blob
}

export async function exportAttendanceReportPdf(params: {
  classroomId: number
  startDate: string
  endDate: string
}) {
  const response = await apiClient.get("/api/attendance/report/export/pdf", {
    responseType: "blob",
    params: {
      classroom_id: params.classroomId,
      start_date: params.startDate,
      end_date: params.endDate,
    },
  })
  return response.data as Blob
}

export async function exportAttendancePdf(classroomId: number, date?: string) {
  const response = await apiClient.get(`/api/attendance/classroom/${classroomId}/export/pdf`, {
    responseType: "blob",
    params: date ? { date } : undefined,
  })
  return response.data as Blob
}
