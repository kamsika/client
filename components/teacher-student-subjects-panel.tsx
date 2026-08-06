"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Eye,
  Loader2,
  Pencil,
  ScanFace,
  Search,
  Trash2,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"

import { EnrolledSubjectsPicker } from "@/components/enrolled-subjects-picker"
import { TeacherRegisterFaceDialog } from "@/components/face/TeacherRegisterFaceDialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getApiErrorMessage } from "@/lib/api-errors"
import { selectItems } from "@/lib/select-items"
import { studentInitials } from "@/lib/student-qr-payload"
import { listClassrooms } from "@/services/classroom"
import { searchStudents, updateStudentSubjects } from "@/services/student"
import { listSubjects } from "@/services/subject"
import {
  deleteTeacherStudentFace,
  getTeacherStudentFaceStatus,
  type TeacherFaceStatus,
} from "@/services/teacher-face"
import type { Classroom, Student, Subject } from "@/types"

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

function classroomIdOf(student: Student) {
  return student.classroomId ?? student.classroom_id ?? student.classroom?.id ?? null
}

function hasFaceRegistered(student: Student, statusMap: Record<number, boolean>) {
  if (typeof statusMap[student.id] === "boolean") return statusMap[student.id]
  return Boolean(student.has_face_descriptor)
}

export function TeacherStudentSubjectsPanel() {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [gradeFilter, setGradeFilter] = useState("all")
  const [classFilter, setClassFilter] = useState("all")
  const [subjectFilter, setSubjectFilter] = useState("all")

  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<string[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [faceStatusMap, setFaceStatusMap] = useState<Record<number, boolean>>({})
  const [faceDetails, setFaceDetails] = useState<TeacherFaceStatus | null>(null)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftSubjects, setDraftSubjects] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const [faceDialogOpen, setFaceDialogOpen] = useState(false)
  const [faceDialogMode, setFaceDialogMode] = useState<"register" | "update">("register")
  const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [faceActionLoading, setFaceActionLoading] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    void Promise.all([listClassrooms(), listSubjects()])
      .then(([classroomList, subjectList]) => {
        setClassrooms(classroomList)
        setSubjects(subjectList)
      })
      .catch(() => {
        // Filters remain usable without catalogs.
      })
  }, [])

  const refreshFaceStatuses = useCallback((list: Student[]) => {
    setFaceStatusMap(
      Object.fromEntries(list.map((student) => [student.id, Boolean(student.has_face_descriptor)])),
    )
  }, [])

  const loadStudents = useCallback(
    async (search: string, grade: string) => {
      setLoading(true)
      try {
        const data = await searchStudents(search, { grade })
        const list = data.students ?? []
        setStudents(list)
        if (Array.isArray(data.grades)) {
          setGrades(data.grades)
        }
        setSelectedId((current) => {
          if (current && list.some((student) => student.id === current)) {
            return current
          }
          return list[0]?.id ?? null
        })
        refreshFaceStatuses(list)
      } catch (error) {
        setStudents([])
        setSelectedId(null)
        setFaceStatusMap({})
        toast.error(getApiErrorMessage(error, "Failed to search students"))
      } finally {
        setLoading(false)
      }
    },
    [refreshFaceStatuses],
  )

  useEffect(() => {
    void loadStudents(debouncedQuery, gradeFilter)
  }, [debouncedQuery, gradeFilter, loadStudents])

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (classFilter !== "all") {
        const classId = classroomIdOf(student)
        if (String(classId ?? "") !== classFilter) {
          const className = classroomOf(student).toLowerCase()
          const match = classrooms.find((item) => String(item.id) === classFilter)
          if (!match || className !== match.name.toLowerCase()) {
            return false
          }
        }
      }

      if (subjectFilter !== "all") {
        const enrolled = enrolledOf(student).map((item) => item.toLowerCase())
        if (!enrolled.includes(subjectFilter.toLowerCase())) {
          return false
        }
      }

      return true
    })
  }, [students, classFilter, subjectFilter, classrooms])

  const selected = useMemo(
    () => filteredStudents.find((student) => student.id === selectedId) ?? null,
    [filteredStudents, selectedId],
  )

  useEffect(() => {
    if (!selectedId) return
    if (!filteredStudents.some((student) => student.id === selectedId)) {
      setSelectedId(filteredStudents[0]?.id ?? null)
    }
  }, [filteredStudents, selectedId])

  useEffect(() => {
    if (!selected) {
      setDraftSubjects([])
      setEditing(false)
      return
    }
    setDraftSubjects(enrolledOf(selected))
    setEditing(false)
  }, [selected])

  const selectedHasFace = selected ? hasFaceRegistered(selected, faceStatusMap) : false

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

  function openRegisterFace() {
    setFaceDialogMode("register")
    setFaceDialogOpen(true)
  }

  function requestUpdateFace() {
    setConfirmUpdateOpen(true)
  }

  function confirmUpdateFace() {
    setConfirmUpdateOpen(false)
    setFaceDialogMode("update")
    setFaceDialogOpen(true)
  }

  async function handleViewFaceStatus() {
    if (!selected) return
    setFaceActionLoading(true)
    try {
      const status = await getTeacherStudentFaceStatus(selected.id)
      setFaceDetails(status)
      setFaceStatusMap((current) => ({ ...current, [selected.id]: Boolean(status.has_face) }))
      setStatusDialogOpen(true)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load face status"))
    } finally {
      setFaceActionLoading(false)
    }
  }

  async function handleDeleteFace() {
    if (!selected) return
    setFaceActionLoading(true)
    try {
      await deleteTeacherStudentFace(selected.id)
      setFaceStatusMap((current) => ({ ...current, [selected.id]: false }))
      setStudents((current) =>
        current.map((student) =>
          student.id === selected.id ? { ...student, has_face_descriptor: false } : student,
        ),
      )
      setConfirmDeleteOpen(false)
      toast.success("Face data deleted")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete face data"))
    } finally {
      setFaceActionLoading(false)
    }
  }

  function handleFaceRegistered() {
    if (!selected) return
    setFaceStatusMap((current) => ({ ...current, [selected.id]: true }))
    setStudents((current) =>
      current.map((student) =>
        student.id === selected.id ? { ...student, has_face_descriptor: true } : student,
      ),
    )
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Student Details & Subject Management</CardTitle>
          <CardDescription>
            Search by name or student ID, filter the list, then manage subjects and face registration.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="relative max-w-xl">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder='Search by name or ID (e.g. "Pravin")'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="filter-grade">Grade</Label>
              <Select
                value={gradeFilter}
                onValueChange={(value) => value && setGradeFilter(value)}
                items={selectItems([
                  { value: "all", label: "All grades" },
                  ...grades.map((grade) => ({ value: grade, label: grade })),
                ])}
              >
                <SelectTrigger id="filter-grade" className="w-full">
                  <SelectValue placeholder="All grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All grades</SelectItem>
                  {grades.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-class">Class</Label>
              <Select
                value={classFilter}
                onValueChange={(value) => value && setClassFilter(value)}
                items={selectItems([
                  { value: "all", label: "All classes" },
                  ...classrooms.map((classroom) => ({
                    value: classroom.id,
                    label: classroom.name,
                  })),
                ])}
              >
                <SelectTrigger id="filter-class" className="w-full">
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classrooms.map((classroom) => (
                    <SelectItem key={classroom.id} value={String(classroom.id)}>
                      {classroom.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-subject">Subject</Label>
              <Select
                value={subjectFilter}
                onValueChange={(value) => value && setSubjectFilter(value)}
                items={selectItems([
                  { value: "all", label: "All subjects" },
                  ...subjects.map((subject) => ({
                    value: subject.name,
                    label: subject.name,
                  })),
                ])}
              >
                <SelectTrigger id="filter-subject" className="w-full">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.name}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Search results</CardTitle>
            <CardDescription>
              {loading
                ? "Searching…"
                : `${filteredStudents.length} student${filteredStudents.length === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[28rem] space-y-1 overflow-y-auto p-2">
            {loading && (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Loading
              </div>
            )}
            {!loading && filteredStudents.length === 0 && (
              <p className="text-muted-foreground px-3 py-8 text-center text-sm">
                No students found. Try another name, ID, or filter.
              </p>
            )}
            {!loading &&
              filteredStudents.map((student) => {
                const active = student.id === selectedId
                const registered = hasFaceRegistered(student, faceStatusMap)
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
                    <div className="min-w-0 flex-1">
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
                      <p
                        className={`mt-0.5 truncate text-[11px] ${
                          active ? "text-primary-foreground/90" : "text-muted-foreground"
                        }`}
                      >
                        Face Status: {registered ? "🟢 Registered" : "🔴 Not Registered"}
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
              <p>Search and choose a student to view their profile, subjects, and face registration.</p>
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
                    <div className="mt-2">
                      <Badge
                        variant="outline"
                        className={
                          selectedHasFace
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-red-200 bg-red-50 text-red-800"
                        }
                      >
                        Face Status: {selectedHasFace ? "🟢 Registered" : "🔴 Not Registered"}
                      </Badge>
                    </div>
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

                <div className="space-y-3 rounded-xl border border-[#A2D4ED]/50 bg-[#f8fbfe] p-4">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-[#05082E]">
                      <ScanFace className="size-4 text-[#0047AB]" />
                      Face Registration
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      Register or update the face embedding used for Face Attendance.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!selectedHasFace ? (
                      <Button type="button" onClick={openRegisterFace}>
                        <ScanFace className="size-4" />
                        Register Face
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" onClick={requestUpdateFace}>
                        <ScanFace className="size-4" />
                        Update Face
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={faceActionLoading}
                      onClick={() => void handleViewFaceStatus()}
                    >
                      {faceActionLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                      View Face Status
                    </Button>
                    {selectedHasFace && (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDeleteOpen(true)}
                      >
                        <Trash2 className="size-4" />
                        Delete Face
                      </Button>
                    )}
                  </div>
                </div>

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

      {selected && (
        <TeacherRegisterFaceDialog
          student={selected}
          open={faceDialogOpen}
          mode={faceDialogMode}
          onOpenChange={setFaceDialogOpen}
          onRegistered={handleFaceRegistered}
        />
      )}

      <AlertDialog open={confirmUpdateOpen} onOpenChange={setConfirmUpdateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace registered face?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the existing face embedding for{" "}
              {selected?.full_name || selected?.registration_no}. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUpdateFace}>Update Face</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete face data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the registered face for{" "}
              {selected?.full_name || selected?.registration_no}. Face attendance will stop working
              for this student until they register again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={faceActionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={faceActionLoading}
              onClick={() => void handleDeleteFace()}
            >
              {faceActionLoading ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete Face
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Face Status</AlertDialogTitle>
            <AlertDialogDescription>
              Registration details for {selected?.full_name || selected?.registration_no}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Status: </span>
              {faceDetails?.has_face ? "🟢 Registered" : "🔴 Not Registered"}
            </p>
            <p>
              <span className="text-muted-foreground">Student ID: </span>
              <span className="font-mono">{selected?.registration_no}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Registered on: </span>
              {faceDetails?.registration_date || faceDetails?.registrationDate || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Last updated: </span>
              {faceDetails?.updated_at || faceDetails?.updatedAt || "—"}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
