"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Pencil, Search, UserRound } from "lucide-react"
import { toast } from "sonner"

import { EnrolledSubjectsPicker } from "@/components/enrolled-subjects-picker"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getApiErrorMessage } from "@/lib/api-errors"
import { studentInitials } from "@/lib/student-qr-payload"
import { searchStudents, updateStudentSubjects } from "@/services/student"
import type { Student } from "@/types"

function enrolledOf(student: Student) {
  return student.enrolledSubjects ?? student.enrolled_subjects ?? []
}

function classroomOf(student: Student) {
  return (
    student.classroomName ||
    student.classroom_name ||
    student.classroom?.name ||
    [student.grade, student.section].filter(Boolean).join(" · ") ||
    "—"
  )
}

export function TeacherStudentSubjectsPanel() {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [students, setStudents] = useState<Student[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftSubjects, setDraftSubjects] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const loadStudents = useCallback(async (search: string) => {
    setLoading(true)
    try {
      const data = await searchStudents(search)
      setStudents(data.students ?? [])
      setSelectedId((current) => {
        if (current && data.students?.some((student) => student.id === current)) {
          return current
        }
        return data.students?.[0]?.id ?? null
      })
    } catch (error) {
      setStudents([])
      setSelectedId(null)
      toast.error(getApiErrorMessage(error, "Failed to search students"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStudents(debouncedQuery)
  }, [debouncedQuery, loadStudents])

  const selected = useMemo(
    () => students.find((student) => student.id === selectedId) ?? null,
    [students, selectedId],
  )

  useEffect(() => {
    if (!selected) {
      setDraftSubjects([])
      setEditing(false)
      return
    }
    setDraftSubjects(enrolledOf(selected))
    setEditing(false)
  }, [selected])

  async function handleSaveSubjects() {
    if (!selected) return
    setSaving(true)
    try {
      const result = await updateStudentSubjects(selected.id, draftSubjects)
      const updated = result.student
      setStudents((current) =>
        current.map((student) => (student.id === updated.id ? { ...student, ...updated } : student)),
      )
      setEditing(false)
      toast.success(result.message || "Enrolled subjects updated")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update subjects"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Student Details & Subject Management</CardTitle>
          <CardDescription>
            Search by name or student ID, then review and edit enrolled subjects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-xl">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder='Search by name or ID (e.g. "Pravin")'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Search results</CardTitle>
            <CardDescription>
              {loading
                ? "Searching…"
                : `${students.length} student${students.length === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[28rem] space-y-1 overflow-y-auto p-2">
            {loading && (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Loading
              </div>
            )}
            {!loading && students.length === 0 && (
              <p className="text-muted-foreground px-3 py-8 text-center text-sm">
                No students found. Try another name or ID.
              </p>
            )}
            {!loading &&
              students.map((student) => {
                const active = student.id === selectedId
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setSelectedId(student.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    <Avatar size="sm">
                      <AvatarFallback
                        className={active ? "bg-primary-foreground/20 text-primary-foreground" : undefined}
                      >
                        {studentInitials(student.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {student.full_name || "Unnamed student"}
                      </p>
                      <p
                        className={`truncate font-mono text-xs ${
                          active ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        {student.registration_no}
                      </p>
                    </div>
                  </button>
                )
              })}
          </CardContent>
        </Card>

        <Card>
          {!selected ? (
            <CardContent className="text-muted-foreground flex min-h-72 flex-col items-center justify-center gap-2 text-center text-sm">
              <UserRound className="size-10 opacity-40" />
              <p className="font-medium text-foreground">Select a student</p>
              <p>Search and choose a student to view their profile and enrolled subjects.</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <Avatar size="lg">
                    <AvatarFallback>{studentInitials(selected.full_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle>{selected.full_name || "Unnamed student"}</CardTitle>
                    <CardDescription>
                      Roll Number:{" "}
                      <span className="font-mono text-foreground">{selected.registration_no}</span>
                    </CardDescription>
                  </div>
                </div>
                {!editing ? (
                  <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                    <Pencil className="size-4" />
                    Edit Subjects
                  </Button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => {
                        setDraftSubjects(enrolledOf(selected))
                        setEditing(false)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="button" disabled={saving} onClick={() => void handleSaveSubjects()}>
                      {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                      Save Subjects
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border px-4 py-3">
                    <dt className="text-muted-foreground text-xs uppercase tracking-wide">Name</dt>
                    <dd className="mt-1 font-medium">{selected.full_name || "—"}</dd>
                  </div>
                  <div className="rounded-lg border px-4 py-3">
                    <dt className="text-muted-foreground text-xs uppercase tracking-wide">
                      Roll Number
                    </dt>
                    <dd className="mt-1 font-mono font-medium">{selected.registration_no}</dd>
                  </div>
                  <div className="rounded-lg border px-4 py-3 sm:col-span-2">
                    <dt className="text-muted-foreground text-xs uppercase tracking-wide">
                      Classroom
                    </dt>
                    <dd className="mt-1 font-medium">{classroomOf(selected)}</dd>
                  </div>
                </dl>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">Enrolled Subjects</h3>
                    <p className="text-muted-foreground text-xs">
                      Subjects this student is registered for.
                    </p>
                  </div>

                  {!editing ? (
                    enrolledOf(selected).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {enrolledOf(selected).map((subject) => (
                          <Badge key={subject} variant="secondary" className="px-3 py-1 text-sm">
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-sm">
                        No enrolled subjects yet. Click Edit Subjects to assign some.
                      </p>
                    )
                  ) : (
                    <EnrolledSubjectsPicker value={draftSubjects} onChange={setDraftSubjects} />
                  )}
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
