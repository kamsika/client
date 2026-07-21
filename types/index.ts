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
  schedule_start_time: string
  teacher_id: number
  teacher_name: string | null
}

export interface Student {
  id: number
  institution_id: number
  user_id: number
  parent_id: number
  registration_no: string
  full_name: string | null
  email: string | null
  parent_name: string | null
  parent_phone: string | null
  has_face_descriptor?: boolean
}

export interface Attendance {
  id: number
  student_id: number
  classroom_id: number
  date: string
  arrival_time: string | null
  status: "Present" | "Absent" | "Late"
  marked_by: number | null
  student_name: string | null
  registration_no: string | null
}

export interface AttendanceRecord {
  student: Student
  attendance: Attendance | null
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
