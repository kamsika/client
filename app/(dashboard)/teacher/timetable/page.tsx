"use client"

import { DashboardShell } from "@/components/dashboard-shell"
import { TimetableManager } from "@/components/timetable-manager"
import { getTeacherNav } from "@/lib/teacher-nav"

export default function TeacherTimetablePage() {
  return (
    <DashboardShell title="Timetable" navItems={getTeacherNav()} allowedRoles={["teacher"]}>
      <TimetableManager />
    </DashboardShell>
  )
}
