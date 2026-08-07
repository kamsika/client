import { apiClient } from "@/lib/api-client"
import type {
  Attendance,
  AttendanceReportResponse,
  ClassroomAttendanceResponse,
  StudentAttendanceHistoryResponse,
} from "@/types"

export interface AttendanceSubjectOption {
  slotId: number
  slot_id?: number
  subjectName: string
  subject_name?: string
  startTime: string
  start_time?: string
  endTime: string
  end_time?: string
  timeRange?: string
  isCurrent?: boolean
  is_current?: boolean
  isUpcoming?: boolean
  is_upcoming?: boolean
  isEnrolled?: boolean
  is_enrolled?: boolean
  selected?: boolean
  alreadyMarked?: boolean
  already_marked?: boolean
  disabled?: boolean
}

/** Shape used by continuous-class subject pickers (scan/kiosk flows). */
export type SelectableAttendanceSubject = {
  id?: number
  subjectId?: number
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
}

export type AttendanceScanResponse = {
  success?: boolean
  status?: string
  message?: string
  studentId?: number
  studentName?: string | null
  registrationNo?: string
  enrolledSubjects?: string[]
  enrolled_subjects?: string[]
  todayTimetable?: Array<{
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
  unenrolledSubjects?: string[]
  unenrolled_subjects?: string[]
  enrollmentWarning?: string | null
  warning?: string
  autoMarkedDetails?: Array<{
    subjectName?: string
    subject_name?: string
    status?: string
    continuousClass?: boolean
    label?: string
  }>
  attendanceOptions?: AttendanceSubjectOption[]
  attendance_options?: AttendanceSubjectOption[]
  attendanceSelectionRequired?: boolean
  attendance_selection_required?: boolean
  monthlyPayment?: {
    billing_period: string
    amount_due: number | null
    payment_status: "Pending" | "Paid" | "Overdue"
    paid_at: string | null
  }
  monthly_payment?: AttendanceScanResponse["monthlyPayment"]
  paymentStatus?: "Pending" | "Paid" | "Overdue"
  payment_status?: "Pending" | "Paid" | "Overdue"
  data?: Attendance
  attendance?: Attendance
  records?: Attendance[]
  delta_minutes?: number
}

/** Attendance input method — both scanners call the same `/api/attendance/scan` flow. */
export type AttendanceMethod = "QR" | "FACE"

/**
 * Shared attendance processor for QR and Face scanners.
 * Identification happens upstream; this only marks attendance via the existing scan API.
 */
export async function processAttendance(payload: {
  studentId: string
  classroomId?: number
  selectedSubjects?: string[]
  selectedSubjectIds?: number[]
  attendanceMethod?: AttendanceMethod
  scannedAt?: string
}) {
  const studentId = payload.studentId?.trim()
  if (!studentId) {
    throw new Error("student_id is required")
  }
  if (
    !(payload.selectedSubjectIds && payload.selectedSubjectIds.length > 0) &&
    !(payload.selectedSubjects && payload.selectedSubjects.length > 0)
  ) {
    throw new Error("Select at least one subject")
  }

  const methodLabel = (payload.attendanceMethod || "QR").toUpperCase() === "FACE" ? "FACE" : "QR"
  const markedVia = methodLabel === "FACE" ? "face" : "qr"

  console.log(
    `[${methodLabel}] processAttendance student:`,
    studentId,
    "subjects:",
    payload.selectedSubjects,
    "subjectIds:",
    payload.selectedSubjectIds,
  )

  const { data } = await apiClient.post<AttendanceScanResponse>("/api/attendance/scan", {
    student_id: studentId,
    classroom_id: payload.classroomId,
    status: "Present",
    scanned_at: payload.scannedAt ?? new Date().toISOString(),
    prevent_duplicate: true,
    selected_subjects: payload.selectedSubjects,
    selected_subject_ids: payload.selectedSubjectIds,
    marked_via: markedVia,
    markedVia,
    attendance_method: methodLabel,
    attendanceMethod: methodLabel,
  })
  return data
}

export async function markAttendanceByScan(
  scannedStudentId: string,
  classroomId: number,
  scannedAt: string,
  selectedSubjects?: string[],
) {
  return processAttendance({
    studentId: scannedStudentId,
    classroomId,
    scannedAt,
    selectedSubjects,
    attendanceMethod: "QR",
  })
}

export async function scanCenterAttendance(payload: {
  scannedStudentId: string
  classroomId?: number
  selectedSubjects?: string[]
  selectedSubjectIds?: number[]
}) {
  if (!payload.scannedStudentId?.trim()) {
    throw new Error("Invalid QR code")
  }
  return processAttendance({
    studentId: payload.scannedStudentId,
    classroomId: payload.classroomId,
    selectedSubjects: payload.selectedSubjects,
    selectedSubjectIds: payload.selectedSubjectIds,
    attendanceMethod: "QR",
  })
}

export async function getCenterAttendance(params?: {
  date?: string
  classroomId?: number
  grade?: string
  subject?: string
  search?: string
}) {
  const { data } = await apiClient.get<{
    date: string
    institution_id: number | null
    classroom_id: number | null
    grade?: string | null
    subject?: string | null
    search?: string | null
    count: number
    records: Attendance[]
  }>("/api/attendance/today", {
    params: {
      date: params?.date,
      classroom_id: params?.classroomId,
      grade: params?.grade,
      subject: params?.subject,
      search: params?.search,
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
  selectedSubjects?: string[]
}) {
  const { data } = await apiClient.post<AttendanceScanResponse>(
    "/api/attendance",
    {
      studentId: payload.studentId,
      classroomId: payload.classroomId,
      status: "Present",
      timestamp: payload.timestamp ?? new Date().toISOString(),
      selectedSubjects: payload.selectedSubjects,
      markedVia: "face",
      marked_via: "face",
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

export interface ManualAttendanceStudentRow {
  studentId: number
  fullName: string | null
  registrationNo: string
  grade?: string | null
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
  grade?: string
}) {
  const { data } = await apiClient.get<ManualAttendanceRoster>("/api/attendance/manual", {
    params: {
      classroomId: params.classroomId,
      subjectName: params.subjectName,
      date: params.date,
      grade: params.grade && params.grade !== "All" ? params.grade : undefined,
    },
  })
  return data
}

export async function saveManualAttendance(payload: {
  classroomId: number
  subjectName: string
  date: string
  markingTime?: string
  forceOverwrite?: boolean
  students: Array<{ studentId: number; status: "Present" | "Absent" | "Late" }>
}) {
  const { data } = await apiClient.post<{
    success: true
    message: string
    count: number
    records: Attendance[]
    markedVia: "manual"
    attendanceMethod?: "Manual"
    errors?: string[] | null
    qrConflicts?: Array<{ studentId: number; fullName?: string | null }> | null
    code?: string
  }>("/api/attendance/manual", {
    ...payload,
    forceOverwrite: payload.forceOverwrite,
    overwriteQr: payload.forceOverwrite,
  })
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
