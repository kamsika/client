export interface User {
  id: number
  institution_id: number | null
  email: string
  role: "super_admin" | "institution_admin" | "teacher" | "student" | "parent"
  full_name: string
  phone_number: string | null
  is_active: boolean
  institution?: Institution
}

export interface Institution {
  id: number
  name: string
  subdomain: string
  status: "Active" | "Suspended"
  created_at: string
}

export interface Classroom {
  id: number
  institution_id: number
  name: string
  grade?: string | null
  schedule_start_time: string
  teacher_id: number
  teacher_name: string | null
  subject_teachers?: ClassroomSubjectTeacher[]
}

export interface ClassroomSubjectTeacher {
  subject: string
  subjectName?: string
  teacher_id: number
  teacherId?: number
  teacher_name?: string | null
  teacherName?: string | null
}

export interface Subject {
  id: number
  institution_id: number
  institutionId?: number
  name: string
  code?: string | null
  teacher_id?: number | null
  teacherId?: number | null
  teacher_name?: string | null
  teacherName?: string | null
  created_at?: string | null
  createdAt?: string | null
}

export interface Student {
  id: number
  institution_id: number
  institutionId?: number
  institution_name?: string | null
  institutionName?: string | null
  tuition_center_name?: string | null
  tuitionCenterName?: string | null
  user_id: number
  parent_id: number
  registration_no: string
  full_name: string | null
  email: string | null
  contact: string | null
  grade: string | null
  section: string | null
  gender: string | null
  parent_name: string | null
  parent_phone: string | null
  has_face_descriptor?: boolean
  profile_photo?: string | null
  profilePhoto?: string | null
  photo_url?: string | null
  photoUrl?: string | null
  enrolled_subjects?: string[]
  enrolledSubjects?: string[]
  registered_subjects?: Array<{
    id?: number | null
    name: string
    code?: string | null
    teacher_id?: number | null
    teacherId?: number | null
    teacher_name?: string | null
    teacherName?: string | null
  }>
  registeredSubjects?: Array<{
    id?: number | null
    name: string
    code?: string | null
    teacher_id?: number | null
    teacherId?: number | null
    teacher_name?: string | null
    teacherName?: string | null
  }>
  already_marked_subjects?: string[]
  alreadyMarkedSubjects?: string[]
  already_marked_subject_details?: Array<{
    id?: number | null
    subject_id?: number | null
    subjectId?: number | null
    name?: string
    subject_name?: string
    subjectName?: string
  }>
  alreadyMarkedSubjectDetails?: Array<{
    id?: number | null
    subject_id?: number | null
    subjectId?: number | null
    name?: string
    subject_name?: string
    subjectName?: string
  }>
  classroom_id?: number | null
  classroomId?: number | null
  classroom_name?: string | null
  classroomName?: string | null
  classroom?: { id: number; name: string; grade?: string | null } | null
  monthlyPayment?: StudentFeePayment | null
  monthly_payment?: StudentFeePayment | null
  currentMonthFee?: StudentFeePayment | null
  current_month_fee?: StudentFeePayment | null
  paymentStatus?: "Pending" | "Paid" | "Overdue"
  payment_status?: "Pending" | "Paid" | "Overdue"
}

export interface StudentFeePayment {
  id?: number | null
  student_id?: number
  studentId?: number
  student_name?: string | null
  studentName?: string | null
  registration_no?: string | null
  registrationNo?: string | null
  grade?: string | null
  month?: number | null
  year?: number | null
  month_name?: string | null
  monthName?: string | null
  amount?: number | null
  amount_due?: number | null
  amountDue?: number | null
  payment_status: "Pending" | "Paid" | "Overdue"
  paymentStatus?: "Pending" | "Paid" | "Overdue"
  payment_date?: string | null
  paymentDate?: string | null
  billing_period?: string
  billingPeriod?: string
  paid_at?: string | null
  paidAt?: string | null
  exists?: boolean
  created_at?: string | null
  createdAt?: string | null
  updated_at?: string | null
  updatedAt?: string | null
  collected_by?: number | null
  collectedBy?: number | null
  collected_by_name?: string | null
  collectedByName?: string | null
}

export interface Attendance {
  id: number
  student_id: number
  classroom_id: number
  class_id?: number
  center_id?: number | null
  institution_id?: number | null
  classroom_name?: string | null
  date: string
  arrival_time: string | null
  status: "Present" | "Absent" | "Late"
  subject_id?: number | null
  subjectId?: number | null
  subject_name?: string | null
  subjectName?: string | null
  marked_via?: string | null
  markedVia?: string | null
  marked_by: number | null
  checker_id?: number | null
  checkerId?: number | null
  student_name: string | null
  registration_no: string | null
}

export interface AttendanceRecord {
  student: Student
  attendance: Attendance | null
  effective_status?: "Absent"
}

export interface AttendanceSummary {
  total_enrolled: number
  total_present: number
  total_absent: number
  attendance_rate: number
}

export interface ClassroomAttendanceResponse {
  classroom: Classroom
  date: string
  records: AttendanceRecord[]
  present: AttendanceRecord[]
  absent: AttendanceRecord[]
  summary: AttendanceSummary
}

export interface StudentAttendanceHistorySummary {
  total_classes: number
  total_present: number
  total_absent: number
  percentage: number
  classroom_id: number | null
  classroom_name: string | null
  start_date: string | null
  end_date: string | null
}

export interface StudentAttendanceHistoryResponse {
  student: Student
  attendance: Attendance[]
  summary: StudentAttendanceHistorySummary
}

export interface AttendanceReportStudentRow {
  student_id: number
  registration_no: string
  student_name: string | null
  total_classes: number
  total_present: number
  total_absent: number
  percentage: number
}

export interface AttendanceReportResponse {
  classroom: Classroom
  start_date: string
  end_date: string
  total_classes_held: number
  student_count: number
  students: AttendanceReportStudentRow[]
}

export interface TeacherAttendanceStudentRow {
  studentId: number
  fullName: string | null
  registrationNo: string
  grade: string | null
  section: string | null
  status: "Present" | "Absent" | "Late"
  statusIndicator: string
  timestamp: string | null
  classroomId: number | null
  classroomName: string | null
  attendanceId: number | null
  subjectName?: string | null
  subject_name?: string | null
  subjectId?: number | null
  subject_id?: number | null
  monthlyPayment?: {
    billing_period: string
    amount_due: number | null
    payment_status: "Pending" | "Paid" | "Overdue"
    paid_at: string | null
  }
  monthlyPaymentStatus?: "Pending" | "Paid" | "Overdue"
}

export interface TeacherAttendanceHistoryRecord {
  attendanceId: number | null
  studentId: number
  fullName: string | null
  registrationNo: string
  grade: string | null
  subjectName: string | null
  subject_name?: string | null
  subjectId?: number | null
  subject_id?: number | null
  date: string
  timestamp: string | null
  status: "Present" | "Absent" | "Late"
  statusIndicator?: string
  classroomId?: number | null
  classroomName?: string | null
  markedVia?: string | null
  marked_via?: string | null
  markedBy?: number | null
  marked_by?: number | null
}

export interface TeacherAttendanceOverview {
  date: string
  classroomId: number | null
  classrooms: Classroom[]
  selectedGrade?: string
  selected_grade?: string
  selectedSubject?: string
  selected_subject?: string
  grades?: string[]
  subjects?: string[]
  summary: {
    totalStudents: number
    presentCount: number
    absentCount: number
    lateCount: number
    totalRecords?: number
    gradesAttended?: number
    grades_attended?: number
    selectedGrade?: string
  }
  analytics?: {
    gradeWise?: Array<{
      grade: string
      totalStudents: number
      presentCount: number
      percentage: number
    }>
    grade_wise?: Array<{
      grade: string
      totalStudents: number
      presentCount: number
      percentage: number
    }>
    subjectWise?: Array<{
      subject: string
      totalStudents: number
      presentCount: number
      percentage: number
    }>
    subject_wise?: Array<{
      subject: string
      totalStudents: number
      presentCount: number
      percentage: number
    }>
    monthly?: Array<{
      date: string
      label: string
      presentCount: number
      recordCount: number
    }>
    gradesAttended?: string[]
    grades_attended?: string[]
    gradesAttendedCount?: number
    grades_attended_count?: number
  }
  students: TeacherAttendanceStudentRow[]
  records?: TeacherAttendanceHistoryRecord[]
}

export interface TimetableSlot {
  id: number
  tenant_id: number
  tenantId: number
  classroom_id: number | null
  classroomId: number | null
  student_id: number | null
  studentId: number | null
  teacher_id?: number | null
  teacherId?: number | null
  teacher_name?: string | null
  teacherName?: string | null
  day_of_week: string
  dayOfWeek: string
  subject_name: string
  subjectName: string
  start_time: string
  startTime: string
  end_time: string
  endTime: string
  classroom_name?: string | null
  student_name?: string | null
  registration_no?: string | null
}

export interface StudyLog {
  id: number
  student_id: number
  start_time: string
  end_time: string | null
  duration_minutes: number | null
}

export interface StudyAnalytics {
  series: { date: string; minutes: number }[]
  total_minutes: number
  total_hours?: number
}

export interface SmsLog {
  id: number
  institution_id: number
  recipient_phone: string
  message_body: string
  status: "Sent" | "Delivered" | "Failed"
  error_details: string | null
  sent_at: string
}

export interface BillingRecord {
  id: number
  institution_id: number
  billing_period: string
  saas_flat_fee: number
  sms_count: number
  sms_unit_price: number
  total_amount_due: number
  payment_status: "Pending" | "Paid" | "Overdue"
}

export interface AuthResponse {
  access_token: string
  user: User
}

export interface ParentAttendanceDay {
  date: string
  status: "Present" | "Absent" | "Late"
  arrival_time: string | null
}

export interface ParentAttendanceSummary {
  total_present: number
  total_late: number
  total_absent: number
  total_marked: number
  percentage: number
}

export interface ParentAttendanceResponse {
  student: Student
  month: number
  year: number
  days_in_month: number
  records: ParentAttendanceDay[]
  summary: ParentAttendanceSummary
}
