"use client"

import { InstitutionAdminShell } from "@/components/institution-admin-shell"
import { AttendanceReportsPanel } from "@/components/attendance-reports-panel"
import { getAdminNav } from "@/lib/admin-nav"

export default function AdminAttendanceReportsPage() {
  return (
    <InstitutionAdminShell
      title="Attendance Reports"
      navItems={getAdminNav(false)}
      allowedRoles={["institution_admin"]}
    >
      <AttendanceReportsPanel />
    </InstitutionAdminShell>
  )
}
