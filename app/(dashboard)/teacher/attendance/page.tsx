"use client"

import { DashboardShell } from "@/components/dashboard-shell"
import { TeacherAttendanceDashboard } from "@/components/teacher-attendance-dashboard"
import { getTeacherNav } from "@/lib/teacher-nav"

export default function TeacherAttendancePage() {
  return (
    <DashboardShell title="Attendance" navItems={getTeacherNav()} allowedRoles={["teacher"]}>
      <TeacherAttendanceDashboard />
    </DashboardShell>
  )
}
