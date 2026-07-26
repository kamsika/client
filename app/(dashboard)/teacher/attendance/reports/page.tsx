"use client"

import { AttendanceReportsPanel } from "@/components/attendance-reports-panel"
import { TeacherShell } from "@/components/teacher-shell"

export default function TeacherAttendanceReportsPage() {
  return (
    <TeacherShell title="Attendance Reports">
      <AttendanceReportsPanel />
    </TeacherShell>
  )
}
