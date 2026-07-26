"use client"

import { DashboardShell } from "@/components/dashboard-shell"
import { KioskAttendanceScreen } from "@/components/kiosk-attendance-screen"
import { getAdminNav } from "@/lib/admin-nav"

export default function AdminKioskAttendancePage() {
  return (
    <DashboardShell
      title="Face Kiosk"
      navItems={getAdminNav(false)}
      allowedRoles={["institution_admin"]}
    >
      <KioskAttendanceScreen />
    </DashboardShell>
  )
}
