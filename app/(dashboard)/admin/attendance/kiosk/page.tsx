"use client"

import { InstitutionAdminShell } from "@/components/institution-admin-shell"
import { KioskAttendanceScreen } from "@/components/kiosk-attendance-screen"
import { getAdminNav } from "@/lib/admin-nav"

export default function AdminKioskAttendancePage() {
  return (
    <InstitutionAdminShell
      title="Face Kiosk"
      navItems={getAdminNav(false)}
      allowedRoles={["institution_admin"]}
    >
      <KioskAttendanceScreen />
    </InstitutionAdminShell>
  )
}
