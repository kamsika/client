"use client"

import { DashboardShell } from "@/components/dashboard-shell"
import { TimetableManager } from "@/components/timetable-manager"
import { getAdminNav } from "@/lib/admin-nav"

export default function AdminTimetablePage() {
  return (
    <DashboardShell
      title="Timetable"
      navItems={getAdminNav(false)}
      allowedRoles={["institution_admin"]}
    >
      <TimetableManager />
    </DashboardShell>
  )
}
