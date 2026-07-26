"use client"

import { TeacherAttendanceDashboard } from "@/components/teacher-attendance-dashboard"
import { TeacherShell } from "@/components/teacher-shell"

export default function TeacherAttendancePage() {
  return (
    <TeacherShell title="Full Roster">
      <TeacherAttendanceDashboard />
    </TeacherShell>
  )
}
