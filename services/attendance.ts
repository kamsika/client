import { apiClient } from "@/lib/api-client"
import type {
  Attendance,
  AttendanceReportResponse,
  ClassroomAttendanceResponse,
  StudentAttendanceHistoryResponse,
} from "@/types"

export type SelectableAttendanceSubject = {
  id?: number
  subjectId?: number
  subject_id?: number
  subjectName?: string
  subject_name?: string
  startTime?: string
  start_time?: string
  endTime?: string
  end_time?: string
  timeRange?: string
  time_range?: string
  isCurrent?: boolean
  is_current?: boolean
  continuous?: boolean
  selectable?: boolean
  canMark?: boolean
  can_mark?: boolean
  defaultChecked?: boolean
  default_checked?: boolean
  label?: string
}

export type AttendanceScanResponse = {
  success?: boolean
  status?: string
  message?: string
  studentId?: number
  studentName?: string | null
  registrationNo?: string
  grade?: string | null
  section?: string | null
  classroomId?: number
  classroomName?: string | null
  classroom_name?: string | null
  enrolledSubjects?: string[]
  enrolled_subjects?: string[]
  requiresSelection?: boolean
  requires_selection?: boolean
  continuousGroup?: boolean
  continuous_group?: boolean
  selectableSubjects?: SelectableAttendanceSubject[]
  selectable_subjects?: SelectableAttendanceSubject[]
  /** Gap/interval classes (>15 min) — display only, not markable. */
  scheduledSubjects?: SelectableAttendanceSubject[]
  scheduled_subjects?: SelectableAttendanceSubject[]
  todayTimetable?: Array<{
    id?: number
    subjectName?: string
    subject_name?: string
    startTime?: string
    start_time?: string
    endTime?: string
    end_time?: string
  }>
  /** Subjects actually marked Present on this scan (active timetable only). */
  markedAttendanceSubjects?: string[]
  marked_attendance_subjects?: string[]
  autoMarkedSubjects?: string[]
  newlyMarkedSubjects?: string[]
  alreadyMarkedSubjects?: string[]
  presentNowDetails?: Array<{
    subjectName?: string
    subject_name?: string
    timeRange?: string | null
    label?: string
    alreadyMarked?: boolean
  }>
  alreadyMarkedDetails?: Array<{
    subjectName?: string
    subject_name?: string
    label?: string
    alreadyMarked?: boolean
  }>
  autoMarkedDetails?: Array<{
    subjectName?: string
    subject_name?: string
    status?: string
    continuousClass?: boolean
    label?: string
  }>
  data?: Attendance
  attendance?: Attendance
  records?: Attendance[]
  delta_minutes?: number
}

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
  selectedSubjectIds?: number[]
}) {
  console.log("Sending student ID to API:", payload.scannedStudentId)
  const body: Record<string, unknown> = {
    student_id: payload.scannedStudentId,
    classroom_id: payload.classroomId,
    status: "Present",
    scanned_at: new Date().toISOString(),
    prevent_duplicate: true,
  }
  if (payload.selectedSubjectIds !== undefined) {
    body.selectedSubjectIds = payload.selectedSubjectIds
  }
  const { data } = await apiClient.post<AttendanceScanResponse>("/api/attendance/scan", body)
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
  selectedSubjectIds?: number[]
}) {
  const body: Record<string, unknown> = {
    studentId: payload.studentId,
    classroomId: payload.classroomId,
    status: "Present",
    timestamp: payload.timestamp ?? new Date().toISOString(),
    markedVia: "face",
  }
  if (payload.selectedSubjectIds !== undefined) {
    body.selectedSubjectIds = payload.selectedSubjectIds
  }
  const { data } = await apiClient.post<AttendanceScanResponse>("/api/attendance", body)
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

export interface ManualAttendanceStudentRow {
  studentId: number
  fullName: string | null
  registrationNo: string
  status: "Present" | "Absent" | "Late" | null
  statusIndicator: string
  markedVia: string | null
  arrivalTime: string | null
  attendance: Attendance | null
}

export interface ManualAttendanceRoster {
  classroom: { id: number; name: string }
  subjectName: string | null
  date: string
  subjects: string[]
  students: ManualAttendanceStudentRow[]
  count: number
}

export async function getManualAttendanceRoster(params: {
  classroomId: number
  subjectName?: string
  date?: string
}) {
  const { data } = await apiClient.get<ManualAttendanceRoster>("/api/attendance/manual", {
    params: {
      classroomId: params.classroomId,
      subjectName: params.subjectName,
      date: params.date,
    },
  })
  return data
}

export async function saveManualAttendance(payload: {
  classroomId: number
  subjectName: string
  date: string
  markingTime?: string
  students: Array<{ studentId: number; status: "Present" | "Absent" | "Late" }>
}) {
  const { data } = await apiClient.post<{
    success: true
    message: string
    count: number
    records: Attendance[]
    markedVia: "manual"
  }>("/api/attendance/manual", payload)
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
