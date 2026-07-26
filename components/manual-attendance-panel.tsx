"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardCheck, Loader2, Save, Search } from "lucide-react"
import { toast } from "sonner"

import { AttendanceDatePicker } from "@/components/attendance-date-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getApiErrorMessage, isManualQrConflict } from "@/lib/api-errors"
import { formatLocalTime, localNowTimeHHMM, localTodayISO } from "@/lib/format-time"
import { cn } from "@/lib/utils"
import {
  getManualAttendanceRoster,
  saveManualAttendance,
  type ManualAttendanceStudentRow,
} from "@/services/attendance"
import { listClassrooms } from "@/services/classroom"
import type { Classroom } from "@/types"

type DraftStatus = "NotMarked" | "Present" | "Absent" | "Late"

const STATUS_OPTIONS: Array<{ value: Exclude<DraftStatus, "NotMarked">; label: string }> = [
  { value: "Present", label: "Present" },
  { value: "Absent", label: "Absent" },
  { value: "Late", label: "Late" },
]

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

const fieldClass =
  "h-10 border-[#A2D4ED] bg-white transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const outlineBtn =
  "border-[#A2D4ED] text-[#0047AB] transition hover:bg-[#ABD2F2]/40"

function statusBadgeClass(status: string | null) {
  if (status === "Present") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (status === "Late") return "border-amber-200 bg-amber-50 text-amber-900"
  if (status === "Absent") return "border-rose-200 bg-rose-50 text-rose-800"
  return "border-[#A2D4ED]/60 bg-[#f8fbfe] text-[#0047AB]/75"
}

function methodLabel(markedVia: string | null | undefined) {
  const value = (markedVia || "").toLowerCase()
  if (value === "qr") return "QR Scan"
  if (value === "manual") return "Manual Entry"
  if (value === "face") return "Face"
  return null
}

function initialDraftStatus(student: ManualAttendanceStudentRow): DraftStatus {
  if (student.status === "Present" || student.status === "Absent" || student.status === "Late") {
    return student.status
  }
  return "NotMarked"
}

export function ManualAttendancePanel() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [classroomId, setClassroomId] = useState("")
  const [gradeFilter, setGradeFilter] = useState("All")
  const [subjectName, setSubjectName] = useState("")
  const [customSubject, setCustomSubject] = useState("")
  const [subjects, setSubjects] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState(localTodayISO)
  const [markingTime, setMarkingTime] = useState(localNowTimeHHMM)
  const [searchQuery, setSearchQuery] = useState("")
  const [students, setStudents] = useState<ManualAttendanceStudentRow[]>([])
  const [draft, setDraft] = useState<Record<number, DraftStatus>>({})
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [saving, setSaving] = useState(false)
  const [qrConfirmOpen, setQrConfirmOpen] = useState(false)

  const selectedClassroom = useMemo(
    () => classrooms.find((item) => String(item.id) === classroomId) ?? null,
    [classrooms, classroomId],
  )

  const gradeOptions = useMemo(() => {
    const grades = new Set<string>()
    for (const classroom of classrooms) {
      if (classroom.grade?.trim()) grades.add(classroom.grade.trim())
    }
    return Array.from(grades).sort((a, b) => a.localeCompare(b))
  }, [classrooms])

  const resolvedSubject = useMemo(() => {
    if (subjectName === "__custom__") return customSubject.trim()
    return subjectName.trim()
  }, [subjectName, customSubject])

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return students
    return students.filter((student) => {
      const name = (student.fullName || "").toLowerCase()
      const id = (student.registrationNo || "").toLowerCase()
      return name.includes(query) || id.includes(query)
    })
  }, [students, searchQuery])

  const pendingSaveCount = useMemo(() => {
    return students.filter((student) => {
      const value = draft[student.studentId]
      return value && value !== "NotMarked"
    }).length
  }, [students, draft])

  useEffect(() => {
    let cancelled = false
    async function loadClassrooms() {
      setLoadingMeta(true)
      try {
        const items = await listClassrooms()
        if (cancelled) return
        setClassrooms(items)
        if (items.length > 0) {
          setClassroomId(String(items[0].id))
          if (items[0].grade?.trim()) setGradeFilter(items[0].grade.trim())
        }
      } catch (error) {
        if (!cancelled) toast.error(getApiErrorMessage(error, "Failed to load classrooms"))
      } finally {
        if (!cancelled) setLoadingMeta(false)
      }
    }
    void loadClassrooms()
    return () => {
      cancelled = true
    }
  }, [])

  const loadRoster = useCallback(async () => {
    if (!classroomId) {
      setStudents([])
      setDraft({})
      return
    }

    setLoadingRoster(true)
    try {
      const data = await getManualAttendanceRoster({
        classroomId: Number(classroomId),
        subjectName: resolvedSubject || undefined,
        date: selectedDate,
        grade: gradeFilter,
      })
      setSubjects(data.subjects ?? [])
      setStudents(data.students ?? [])
      const nextDraft: Record<number, DraftStatus> = {}
      for (const student of data.students ?? []) {
        nextDraft[student.studentId] = initialDraftStatus(student)
      }
      setDraft(nextDraft)
    } catch (error) {
      setStudents([])
      setDraft({})
      toast.error(getApiErrorMessage(error, "Failed to load class roster"))
    } finally {
      setLoadingRoster(false)
    }
  }, [classroomId, gradeFilter, resolvedSubject, selectedDate])

  useEffect(() => {
    void loadRoster()
  }, [loadRoster])

  useEffect(() => {
    if (!subjectName && subjects.length > 0) {
      setSubjectName(subjects[0])
    }
  }, [subjects, subjectName])

  function setStatus(studentId: number, status: DraftStatus) {
    setDraft((prev) => ({ ...prev, [studentId]: status }))
  }

  function markAllPresent() {
    setDraft((prev) => {
      const next = { ...prev }
      for (const student of students) {
        next[student.studentId] = "Present"
      }
      return next
    })
  }

  function buildSavePayload() {
    return students
      .map((student) => ({
        studentId: student.studentId,
        status: draft[student.studentId],
      }))
      .filter(
        (row): row is { studentId: number; status: "Present" | "Absent" | "Late" } =>
          row.status === "Present" || row.status === "Absent" || row.status === "Late",
      )
  }

  function hasQrOverwriteRisk() {
    return students.some((student) => {
      const next = draft[student.studentId]
      if (!next || next === "NotMarked") return false
      return (student.markedVia || "").toLowerCase() === "qr"
    })
  }

  async function performSave(forceOverwrite = false) {
    if (!classroomId) {
      toast.error("Select a classroom")
      return
    }
    if (!resolvedSubject) {
      toast.error("Select or enter a subject")
      return
    }

    const entries = buildSavePayload()
    if (entries.length === 0) {
      toast.error("Select attendance status for at least one student")
      return
    }

    setSaving(true)
    try {
      const result = await saveManualAttendance({
        classroomId: Number(classroomId),
        subjectName: resolvedSubject,
        date: selectedDate,
        markingTime,
        forceOverwrite,
        students: entries,
      })
      if (result.errors?.length) {
        toast.warning(result.errors.join(" "))
      }
      if (result.count > 0) {
        toast.success(result.message || `Saved ${result.count} student(s)`)
      } else if (result.errors?.length) {
        toast.error("No attendance was saved for the selected students.")
      }
      setQrConfirmOpen(false)
      await loadRoster()
    } catch (error) {
      if (isManualQrConflict(error)) {
        setQrConfirmOpen(true)
        return
      }
      toast.error(getApiErrorMessage(error, "Failed to save attendance"))
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (hasQrOverwriteRisk()) {
      setQrConfirmOpen(true)
      return
    }
    await performSave(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[#05082E]">Manual Attendance</h2>
        <p className="text-sm text-[#0047AB]/75">
          Backup to QR scanning — pick classroom, grade, subject, and date, then mark each
          student&apos;s status.
        </p>
      </div>

      <Card className={cardShell}>
        <CardHeader className="gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base text-[#05082E]">
              <ClipboardCheck className="size-4" />
              Session filters
            </CardTitle>
            <CardDescription className="text-[#0047AB]/75">
              Defaults to today. Saved records use the same attendance table as QR marks (
              <span className="font-medium">attendance_method: Manual</span>).
            </CardDescription>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <Label className="text-[#05082E]">Classroom</Label>
              <Select
                value={classroomId}
                onValueChange={(value) => {
                  if (!value) return
                  setClassroomId(value)
                  setSubjectName("")
                  setCustomSubject("")
                  const classroom = classrooms.find((item) => String(item.id) === value)
                  if (classroom?.grade?.trim()) setGradeFilter(classroom.grade.trim())
                }}
                disabled={loadingMeta}
              >
                <SelectTrigger className={fieldClass}>
                  <SelectValue placeholder="Select classroom" />
                </SelectTrigger>
                <SelectContent>
                  {classrooms.map((classroom) => (
                    <SelectItem key={classroom.id} value={String(classroom.id)}>
                      {classroom.name}
                      {classroom.grade ? ` · ${classroom.grade}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[#05082E]">Grade</Label>
              <Select
                value={gradeFilter}
                onValueChange={(value) => value && setGradeFilter(value)}
              >
                <SelectTrigger className={fieldClass}>
                  <SelectValue placeholder="Grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All grades</SelectItem>
                  {gradeOptions.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                  {selectedClassroom?.grade &&
                  !gradeOptions.includes(selectedClassroom.grade) ? (
                    <SelectItem value={selectedClassroom.grade}>
                      {selectedClassroom.grade}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[#05082E]">Subject</Label>
              <Select
                value={subjectName}
                onValueChange={(value) => value && setSubjectName(value)}
                disabled={!classroomId}
              >
                <SelectTrigger className={fieldClass}>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">Other (type below)</SelectItem>
                </SelectContent>
              </Select>
              {subjectName === "__custom__" ? (
                <Input
                  className={fieldClass}
                  placeholder="e.g. Chemistry"
                  value={customSubject}
                  onChange={(event) => setCustomSubject(event.target.value)}
                />
              ) : null}
            </div>

            <AttendanceDatePicker
              id="manual-attendance-date"
              value={selectedDate}
              onChange={setSelectedDate}
            />

            <div className="space-y-2">
              <Label htmlFor="manual-attendance-time" className="text-[#05082E]">
                Marking time
              </Label>
              <Input
                id="manual-attendance-time"
                type="time"
                className={fieldClass}
                value={markingTime}
                onChange={(event) => setMarkingTime(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#A2D4ED]" />
              <Input
                className={cn(fieldClass, "pl-9")}
                placeholder="Search student name or ID…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <Button type="button" size="sm" variant="outline" className={outlineBtn} onClick={markAllPresent}>
              Select All Present
            </Button>
            <Button
              type="button"
              className="bg-[#05082E] text-white hover:bg-[#05082E]/90"
              onClick={() => void handleSave()}
              disabled={saving || loadingRoster || !resolvedSubject || students.length === 0}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save Attendance
              {pendingSaveCount > 0 ? ` (${pendingSaveCount})` : ""}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {!resolvedSubject ? (
            <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-[#A2D4ED]/60 px-6 text-center text-sm text-[#0047AB]/70">
              Choose a subject to load the class roster.
            </div>
          ) : loadingRoster ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-[#0047AB]/70">
              <Loader2 className="size-4 animate-spin" />
              Loading students…
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-[#A2D4ED]/60 px-6 text-center text-sm text-[#0047AB]/70">
              No students match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#A2D4ED]/40">
              <Table className="min-w-[880px]">
                <TableHeader className="bg-[#f8fbfe]">
                  <TableRow className="border-[#A2D4ED]/40 hover:bg-[#f8fbfe]">
                    <TableHead className="text-[#0047AB]">Student Name</TableHead>
                    <TableHead className="text-[#0047AB]">Student ID</TableHead>
                    <TableHead className="text-[#0047AB]">Grade</TableHead>
                    <TableHead className="text-center text-[#0047AB]">Saved status</TableHead>
                    <TableHead className="text-[#0047AB]">Method</TableHead>
                    <TableHead className="text-[#0047AB]">Set status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => {
                    const selected = draft[student.studentId] ?? "NotMarked"
                    const savedLabel = student.status ?? "Not Marked"
                    const method = methodLabel(student.markedVia)
                    return (
                      <TableRow key={student.studentId} className="border-[#A2D4ED]/30">
                        <TableCell className="font-medium text-[#05082E]">
                          {student.fullName || "Unnamed student"}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-[#0047AB]">
                          {student.registrationNo}
                        </TableCell>
                        <TableCell className="text-[#05082E]">{student.grade || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={cn("font-medium", statusBadgeClass(student.status))}
                          >
                            {savedLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-[#0047AB]/80">
                          {method ?? "—"}
                          {student.arrivalTime ? (
                            <div className="font-mono tabular-nums">
                              {formatLocalTime(student.arrivalTime, {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                                second: undefined,
                              })}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant={selected === "NotMarked" ? "default" : "outline"}
                              className={cn(
                                selected === "NotMarked" && "bg-[#0047AB]/90 hover:bg-[#0047AB]",
                              )}
                              onClick={() => setStatus(student.studentId, "NotMarked")}
                            >
                              Not Marked
                            </Button>
                            {STATUS_OPTIONS.map((option) => (
                              <Button
                                key={option.value}
                                type="button"
                                size="sm"
                                variant={selected === option.value ? "default" : "outline"}
                                className={cn(
                                  selected === option.value &&
                                    option.value === "Present" &&
                                    "bg-emerald-600 hover:bg-emerald-700",
                                  selected === option.value &&
                                    option.value === "Absent" &&
                                    "bg-rose-600 hover:bg-rose-700",
                                  selected === option.value &&
                                    option.value === "Late" &&
                                    "bg-amber-600 hover:bg-amber-700",
                                )}
                                onClick={() => setStatus(student.studentId, option.value)}
                              >
                                {option.label}
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={qrConfirmOpen} onOpenChange={setQrConfirmOpen}>
        <DialogContent className="border-[#A2D4ED]/60 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#05082E]">Update QR attendance?</DialogTitle>
            <DialogDescription className="text-[#0047AB]/75">
              Attendance was already marked using QR for at least one selected student. Do you want
              to update it manually instead?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={outlineBtn}
              onClick={() => setQrConfirmOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#05082E] text-white hover:bg-[#05082E]/90"
              disabled={saving}
              onClick={() => void performSave(true)}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Update manually"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
