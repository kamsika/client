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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { buildStudentQrPayload } from "@/lib/student-qr-payload"
import { cn } from "@/lib/utils"
import type { Student } from "@/types"

const fieldClass =
  "h-11 border-[#A2D4ED] bg-white transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const outlineBtn =
  "border-[#A2D4ED] text-[#0047AB] transition hover:bg-[#ABD2F2]/40"

const ALL_GRADES = "__all_grades__"

interface AdminStudentsSectionProps {
  students: Student[]
  loading?: boolean
  onStudentUpdated?: (student: Student) => void
}

function studentGradeLabel(student: Student) {
  const grade = student.grade?.trim()
  return grade || "Ungraded"
}

function gradeSortKey(grade: string) {
  const match = grade.match(/(\d+)/)
  if (match) return [0, Number(match[1]), grade.toLowerCase()] as const
  if (grade === "Ungraded") return [2, 0, grade.toLowerCase()] as const
  return [1, 0, grade.toLowerCase()] as const
}

function compareGrades(a: string, b: string) {
  const left = gradeSortKey(a)
  const right = gradeSortKey(b)
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] < right[i]) return -1
    if (left[i] > right[i]) return 1
  }
  return 0
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
  const [gradeFilter, setGradeFilter] = useState<string>(ALL_GRADES)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const availableGrades = useMemo(() => {
    const grades = new Set<string>()
    let hasUngraded = false
    for (const student of students) {
      const grade = student.grade?.trim()
      if (grade) grades.add(grade)
      else hasUngraded = true
    }
    const list = Array.from(grades).sort(compareGrades)
    if (hasUngraded) list.push("Ungraded")
    return list
  }, [students])

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return students.filter((student) => {
      const gradeLabel = studentGradeLabel(student)
      if (gradeFilter !== ALL_GRADES && gradeLabel.toLowerCase() !== gradeFilter.toLowerCase()) {
        return false
      }
      if (!normalized) return true

      const name = student.full_name?.toLowerCase() ?? ""
      const regNo = student.registration_no.toLowerCase()
      const email = student.email?.toLowerCase() ?? ""
      const grade = gradeLabel.toLowerCase()
      return (
        name.includes(normalized) ||
        regNo.includes(normalized) ||
        email.includes(normalized) ||
        grade.includes(normalized)
      )
    })
  }, [query, students, gradeFilter])

  const groupedStudents = useMemo(() => {
    const groups = new Map<string, Student[]>()
    for (const student of filteredStudents) {
      const grade = studentGradeLabel(student)
      const current = groups.get(grade) ?? []
      current.push(student)
      groups.set(grade, current)
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => compareGrades(a, b))
      .map(([grade, items]) => ({
        grade,
        students: items.slice().sort((a, b) => {
          const nameCmp = (a.full_name || "").localeCompare(b.full_name || "")
          if (nameCmp !== 0) return nameCmp
          return a.registration_no.localeCompare(b.registration_no)
        }),
      }))
  }, [filteredStudents])

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]">
        <div className="border-b border-[#A2D4ED]/40 px-5 py-4">
          <h2 className="text-base font-semibold text-[#05082E]">Students</h2>
          <p className="text-sm text-[#0047AB]/75">
            QR codes are grouped by grade. Each card shows grade, name, student ID, and the unique QR
            payload.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full space-y-1.5 sm:max-w-[220px]">
              <Label className="text-[#05082E]">Grade</Label>
              <Select
                value={gradeFilter}
                onValueChange={(value) => value && setGradeFilter(value)}
              >
                <SelectTrigger className={cn(fieldClass, "w-full")}>
                  <SelectValue placeholder="All Grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_GRADES}>All Grades</SelectItem>
                  {availableGrades.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative w-full max-w-md flex-1">
              <Label className="sr-only" htmlFor="student-qr-search">
                Search students
              </Label>
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#A2D4ED]" />
              <Input
                id="student-qr-search"
                className={cn(fieldClass, "pl-9")}
                placeholder="Search by name, student ID, grade, or email..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
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
              No students match your grade filter or search.
            </p>
          )}

          {!loading && groupedStudents.length > 0 && (
            <div className="space-y-8">
              {groupedStudents.map((group) => (
                <section key={group.grade} className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold tracking-wide text-[#05082E] uppercase">
                      {group.grade}
                    </h3>
                    <div className="mt-1 h-px w-full bg-[#A2D4ED]/60" />
                    <p className="mt-1 text-xs text-[#0047AB]/70">
                      {group.students.length} student{group.students.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {group.students.map((student) => {
                      const payload = buildStudentQrPayload(student.registration_no)
                      const label = studentQrLabel(student)
                      const grade = studentGradeLabel(student)

                      return (
                        <div
                          key={student.id}
                          className="flex flex-col items-center gap-3 rounded-2xl border border-[#A2D4ED]/50 bg-[#f8fbfe] p-4 shadow-[0_6px_20px_rgba(5,8,46,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(162,212,237,0.25)]"
                        >
                          <div className="w-full space-y-1 text-left">
                            <p className="text-xs font-semibold text-[#0047AB]">
                              Grade: <span className="text-[#05082E]">{grade}</span>
                            </p>
                            <p className="text-sm text-[#0047AB]/80">
                              Name:{" "}
                              <span className="font-semibold text-[#05082E]">
                                {student.full_name || "Unnamed student"}
                              </span>
                            </p>
                            <p className="text-sm text-[#0047AB]/80">
                              Student ID:{" "}
                              <span className="font-mono text-xs font-semibold text-[#05082E]">
                                {student.registration_no}
                              </span>
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
                </section>
              ))}
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
