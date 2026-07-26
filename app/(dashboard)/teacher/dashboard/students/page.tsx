"use client"

import { TeacherStudentSubjectsPanel } from "@/components/teacher-student-subjects-panel"

export default function TeacherStudentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[#05082E]">Students</h2>
        <p className="text-sm text-[#0047AB]/75">
          Search students and manage enrolled subjects for attendance.
        </p>
      </div>
      <TeacherStudentSubjectsPanel />
    </div>
  )
}
