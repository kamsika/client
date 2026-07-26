"use client"

import { useMemo, useState } from "react"
import { GraduationCap, Search, UserRound } from "lucide-react"

import { AdminStudentProfile } from "@/components/admin-student-profile"
import { StudentQrCode } from "@/components/student-qr-code"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { buildStudentQrPayload } from "@/lib/student-qr-payload"
import { cn } from "@/lib/utils"
import type { Student } from "@/types"

const fieldClass =
  "h-11 border-[#A2D4ED] bg-white transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const outlineBtn =
  "border-[#A2D4ED] text-[#0047AB] transition hover:bg-[#ABD2F2]/40"

interface AdminStudentsSectionProps {
  students: Student[]
  loading?: boolean
  onStudentUpdated?: (student: Student) => void
}

function studentQrLabel(student: Student) {
  const name = student.full_name?.trim() || "Unnamed student"
  return `${name} (${student.registration_no})`
}

export function AdminStudentsSection({
  students,
  loading = false,
  onStudentUpdated,
}: AdminStudentsSectionProps) {
  const [query, setQuery] = useState("")
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return students

    return students.filter((student) => {
      const name = student.full_name?.toLowerCase() ?? ""
      const regNo = student.registration_no.toLowerCase()
      const email = student.email?.toLowerCase() ?? ""
      return name.includes(normalized) || regNo.includes(normalized) || email.includes(normalized)
    })
  }, [query, students])

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]">
        <div className="border-b border-[#A2D4ED]/40 px-5 py-4">
          <h2 className="text-base font-semibold text-[#05082E]">Students</h2>
          <p className="text-sm text-[#0047AB]/75">
            Each student has a unique QR payload (their Student ID). Labels under each code show who
            it belongs to.
          </p>
          <div className="relative mt-4 max-w-md">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#A2D4ED]" />
            <Input
              className={cn(fieldClass, "pl-9")}
              placeholder="Search by name, student ID, or email..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="p-5">
          {loading && <p className="text-sm text-[#0047AB]/70">Loading students...</p>}

          {!loading && students.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[#A2D4ED]/30 text-[#0047AB]">
                <GraduationCap className="size-5" />
              </span>
              <p className="font-medium text-[#05082E]">No students found</p>
              <p className="text-sm text-[#0047AB]/70">Import students to get started.</p>
            </div>
          )}

          {!loading && students.length > 0 && filteredStudents.length === 0 && (
            <p className="py-8 text-center text-sm text-[#0047AB]/70">
              No students match your search.
            </p>
          )}

          {!loading && filteredStudents.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredStudents.map((student) => {
                const payload = buildStudentQrPayload(student.registration_no)
                const label = studentQrLabel(student)

                return (
                  <div
                    key={student.id}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-[#A2D4ED]/50 bg-[#f8fbfe] p-4 shadow-[0_6px_20px_rgba(5,8,46,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(162,212,237,0.25)]"
                  >
                    <div className="w-full text-center">
                      <p className="font-semibold text-[#05082E]">
                        {student.full_name || "Unnamed student"}
                      </p>
                      <p className="font-mono text-xs text-[#0047AB]/75">
                        {student.registration_no}
                      </p>
                    </div>

                    <StudentQrCode
                      key={`list-qr-${student.id}-${payload}`}
                      studentDbId={student.id}
                      studentId={payload}
                      size={180}
                      label={label}
                    />

                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("w-full", outlineBtn)}
                      onClick={() => setSelectedStudent(student)}
                    >
                      <UserRound className="size-4" />
                      View Profile / Print
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(selectedStudent)}
        onOpenChange={(open) => {
          if (!open) setSelectedStudent(null)
        }}
      >
        <DialogContent className="max-w-3xl border-[#A2D4ED]/40">
          <DialogHeader>
            <DialogTitle className="text-[#05082E]">Student Profile</DialogTitle>
            <DialogDescription>
              {selectedStudent
                ? `${selectedStudent.full_name || "Student"} (${selectedStudent.registration_no})`
                : "QR code for attendance scanning"}
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <AdminStudentProfile
              key={`profile-${selectedStudent.id}-${selectedStudent.registration_no}`}
              student={selectedStudent}
              onStudentUpdated={(updated) => {
                setSelectedStudent(updated)
                onStudentUpdated?.(updated)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
