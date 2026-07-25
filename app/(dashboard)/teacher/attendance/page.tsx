"use client"

import { DashboardShell } from "@/components/dashboard-shell"
import { TeacherAttendanceDashboard } from "@/components/teacher-attendance-dashboard"

const teacherNav = [
  { href: "/teacher/dashboard", label: "Dashboard" },
  { href: "/teacher/attendance", label: "Attendance" },
  { href: "/teacher/attendance/kiosk", label: "Face Kiosk" },
  { href: "/teacher/attendance/reports", label: "Reports" },
]

export default function TeacherAttendancePage() {
  return (
    <DashboardShell title="Attendance" navItems={teacherNav} allowedRoles={["teacher"]}>
      <TeacherAttendanceDashboard />
    </DashboardShell>
  )
}
