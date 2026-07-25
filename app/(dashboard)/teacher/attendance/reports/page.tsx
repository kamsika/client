"use client"

import { DashboardShell } from "@/components/dashboard-shell"
import { AttendanceReportsPanel } from "@/components/attendance-reports-panel"

const teacherNav = [
  { href: "/teacher/dashboard", label: "Dashboard" },
  { href: "/teacher/attendance/reports", label: "Reports" },
]

export default function TeacherAttendanceReportsPage() {
  return (
    <DashboardShell title="Attendance Reports" navItems={teacherNav} allowedRoles={["teacher"]}>
      <AttendanceReportsPanel />
    </DashboardShell>
  )
}
