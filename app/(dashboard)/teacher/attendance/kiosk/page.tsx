"use client"

import { DashboardShell } from "@/components/dashboard-shell"
import { KioskAttendanceScreen } from "@/components/kiosk-attendance-screen"

const teacherNav = [
  { href: "/teacher/dashboard", label: "Dashboard" },
  { href: "/teacher/attendance", label: "Attendance" },
  { href: "/teacher/attendance/kiosk", label: "Face Kiosk" },
  { href: "/teacher/attendance/reports", label: "Reports" },
]

export default function TeacherKioskAttendancePage() {
  return (
    <DashboardShell title="Face Kiosk" navItems={teacherNav} allowedRoles={["teacher"]}>
      <KioskAttendanceScreen />
    </DashboardShell>
  )
}
