"use client"

import { useMemo, useState } from "react"
import { Search, UserRound } from "lucide-react"

import { AdminStudentProfile } from "@/components/admin-student-profile"
import { StudentQrCode } from "@/components/student-qr-code"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { buildStudentQrPayload } from "@/lib/student-qr-payload"
import type { Student } from "@/types"

interface AdminStudentsSectionProps {
  students: Student[]
  loading?: boolean
}

function studentQrLabel(student: Student) {
  const name = student.full_name?.trim() || "Unnamed student"
  return `${name} (${student.registration_no})`
}

export function AdminStudentsSection({ students, loading = false }: AdminStudentsSectionProps) {
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
      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
          <CardDescription>
            Each student has a unique QR payload (their Student ID). Labels under each code show who
            it belongs to.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="Search by name, student ID, or email..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {loading && <p className="text-muted-foreground text-sm">Loading students...</p>}

          {!loading && students.length === 0 && (
            <p className="text-muted-foreground text-sm">No students found. Import students to get started.</p>
          )}

          {!loading && students.length > 0 && filteredStudents.length === 0 && (
            <p className="text-muted-foreground text-sm">No students match your search.</p>
          )}

          {!loading && filteredStudents.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredStudents.map((student) => {
                const payload = buildStudentQrPayload(student.registration_no)
                const label = studentQrLabel(student)

                return (
                  <div
                    key={student.id}
                    className="flex flex-col items-center gap-3 rounded-lg border bg-white p-4 text-black"
                  >
                    <div className="w-full text-center">
                      <p className="font-medium">{student.full_name || "Unnamed student"}</p>
                      <p className="font-mono text-xs text-neutral-600">{student.registration_no}</p>
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
                      className="w-full text-black"
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
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedStudent)}
        onOpenChange={(open) => {
          if (!open) setSelectedStudent(null)
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Student Profile</DialogTitle>
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
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
