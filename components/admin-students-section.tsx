"use client"

import { useMemo, useState } from "react"
import { Search, UserRound } from "lucide-react"

import { AdminStudentProfile } from "@/components/admin-student-profile"
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
import type { Student } from "@/types"

interface AdminStudentsSectionProps {
  students: Student[]
  loading?: boolean
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
          <CardDescription>View student profiles and generate attendance QR codes</CardDescription>
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
            <div className="divide-y rounded-lg border">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="font-medium">{student.full_name || "Unnamed student"}</p>
                    <p className="text-muted-foreground text-sm">ID: {student.registration_no}</p>
                    {student.email && (
                      <p className="text-muted-foreground text-sm">{student.email}</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedStudent(student)}>
                    <UserRound className="size-4" />
                    View Profile
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedStudent)} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Student Profile</DialogTitle>
            <DialogDescription>
              {selectedStudent?.registration_no} — QR code for attendance scanning
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && <AdminStudentProfile student={selectedStudent} />}
        </DialogContent>
      </Dialog>
    </>
  )
}
