"use client"

import { DashboardShell } from "@/components/dashboard-shell"
import { KioskAttendanceScreen } from "@/components/kiosk-attendance-screen"
import { getTeacherNav } from "@/lib/teacher-nav"

export default function TeacherKioskAttendancePage() {
  return (
    <DashboardShell title="Face Kiosk" navItems={getTeacherNav()} allowedRoles={["teacher"]}>
      <KioskAttendanceScreen />
    </DashboardShell>
  )
}
