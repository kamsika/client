"use client"

import { DashboardShell } from "@/components/dashboard-shell"
import { AttendanceReportsPanel } from "@/components/attendance-reports-panel"
import { getAdminNav } from "@/lib/admin-nav"

export default function AdminAttendanceReportsPage() {
  return (
    <DashboardShell
      title="Attendance Reports"
      navItems={getAdminNav(false)}
      allowedRoles={["institution_admin"]}
    >
      <AttendanceReportsPanel />
    </DashboardShell>
  )
}
