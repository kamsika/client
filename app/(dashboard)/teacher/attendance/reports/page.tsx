"use client"

import { DashboardShell } from "@/components/dashboard-shell"
import { AttendanceReportsPanel } from "@/components/attendance-reports-panel"
import { getTeacherNav } from "@/lib/teacher-nav"

export default function TeacherAttendanceReportsPage() {
  return (
    <DashboardShell title="Attendance Reports" navItems={getTeacherNav()} allowedRoles={["teacher"]}>
      <AttendanceReportsPanel />
    </DashboardShell>
  )
}
