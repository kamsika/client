"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardCheck, Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import { AttendanceDatePicker } from "@/components/attendance-date-picker"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getApiErrorMessage } from "@/lib/api-errors"
import { formatLocalTime, localNowTimeHHMM, localTodayISO } from "@/lib/format-time"
import { cn } from "@/lib/utils"
import {
  getManualAttendanceRoster,
  saveManualAttendance,
  type ManualAttendanceStudentRow,
} from "@/services/attendance"
import { listClassrooms } from "@/services/classroom"
import type { Classroom } from "@/types"

type AttendanceStatus = "Present" | "Absent"

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "Present", label: "Present" },
  { value: "Absent", label: "Absent" },
]

function statusBadgeClass(status: string | null) {
  if (status === "Present") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (status === "Late") return "border-amber-200 bg-amber-50 text-amber-900"
  if (status === "Absent") return "border-rose-200 bg-rose-50 text-rose-800"
  return "border-border bg-muted text-muted-foreground"
}

export function ManualAttendancePanel() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [classroomId, setClassroomId] = useState("")
  const [subjectName, setSubjectName] = useState("")
  const [customSubject, setCustomSubject] = useState("")
  const [subjects, setSubjects] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState(localTodayISO)
  const [markingTime, setMarkingTime] = useState(localNowTimeHHMM)
  const [students, setStudents] = useState<ManualAttendanceStudentRow[]>([])
  const [draft, setDraft] = useState<Record<number, AttendanceStatus>>({})
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [saving, setSaving] = useState(false)

  const resolvedSubject = useMemo(() => {
    if (subjectName === "__custom__") return customSubject.trim()
    return subjectName.trim()
  }, [subjectName, customSubject])

  const dirtyCount = useMemo(() => {
    return students.filter((student) => {
      const next = draft[student.studentId]
      const previous = student.status === "Present" ? "Present" : "Absent"
      return Boolean(next && next !== previous)
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
        if (items.length > 0) setClassroomId(String(items[0].id))
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
      })
      setSubjects(data.subjects ?? [])
      setStudents(data.students ?? [])
      const nextDraft: Record<number, AttendanceStatus> = {}
      for (const student of data.students ?? []) {
        // Manual UI only supports Present/Absent.
        nextDraft[student.studentId] =
          student.status === "Present" ? "Present" : "Absent"
      }
      setDraft(nextDraft)
    } catch (error) {
      setStudents([])
      setDraft({})
      toast.error(getApiErrorMessage(error, "Failed to load class roster"))
    } finally {
      setLoadingRoster(false)
    }
  }, [classroomId, resolvedSubject, selectedDate])

  useEffect(() => {
    void loadRoster()
  }, [loadRoster])

  useEffect(() => {
    if (!subjectName && subjects.length > 0) {
      setSubjectName(subjects[0])
    }
  }, [subjects, subjectName])

  function setStatus(studentId: number, status: AttendanceStatus) {
    setDraft((prev) => ({ ...prev, [studentId]: status }))
  }

  function markAll(status: AttendanceStatus) {
    setDraft((prev) => {
      const next = { ...prev }
      for (const student of students) {
        next[student.studentId] = status
      }
      return next
    })
  }

  async function handleSave() {
    if (!classroomId) {
      toast.error("Select a classroom")
      return
    }
    if (!resolvedSubject) {
      toast.error("Select or enter a subject")
      return
    }
    if (students.length === 0) {
      toast.error("No students to save")
      return
    }

    setSaving(true)
    try {
      const result = await saveManualAttendance({
        classroomId: Number(classroomId),
        subjectName: resolvedSubject,
        date: selectedDate,
        markingTime,
        students: students.map((student) => ({
          studentId: student.studentId,
          status: draft[student.studentId] ?? "Absent",
        })),
      })
      toast.success(result.message || `Saved ${result.count} student(s)`)
      await loadRoster()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save attendance"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="size-4" />
            Manual Attendance
          </CardTitle>
          <CardDescription>
            Select classroom, subject, date, and marking time, then mark Present or Absent for each
            student.
          </CardDescription>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Classroom</Label>
            <Select
              value={classroomId}
              onValueChange={(value) => {
                if (!value) return
                setClassroomId(value)
                setSubjectName("")
                setCustomSubject("")
              }}
              disabled={loadingMeta}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select classroom" />
              </SelectTrigger>
              <SelectContent>
                {classrooms.map((classroom) => (
                  <SelectItem key={classroom.id} value={String(classroom.id)}>
                    {classroom.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Select
              value={subjectName}
              onValueChange={(value) => value && setSubjectName(value)}
              disabled={!classroomId}
            >
              <SelectTrigger>
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
            {subjectName === "__custom__" && (
              <Input
                placeholder="e.g. Chemistry"
                value={customSubject}
                onChange={(event) => setCustomSubject(event.target.value)}
              />
            )}
          </div>

          <AttendanceDatePicker
            id="manual-attendance-date"
            value={selectedDate}
            onChange={setSelectedDate}
          />

          <div className="space-y-2">
            <Label htmlFor="manual-attendance-time">Marking time</Label>
            <Input
              id="manual-attendance-time"
              type="time"
              value={markingTime}
              onChange={(event) => setMarkingTime(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => markAll("Present")}>
            Mark all Present
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => markAll("Absent")}>
            Mark all Absent
          </Button>
          <div className="flex-1" />
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loadingRoster || !resolvedSubject || students.length === 0}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Attendance{dirtyCount > 0 ? ` (${dirtyCount} changed)` : ""}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {!resolvedSubject ? (
          <div className="text-muted-foreground flex min-h-40 items-center justify-center rounded-xl border border-dashed px-6 text-center text-sm">
            Choose a subject to load the class roster.
          </div>
        ) : loadingRoster ? (
          <div className="text-muted-foreground flex min-h-40 items-center justify-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading students…
          </div>
        ) : students.length === 0 ? (
          <div className="text-muted-foreground flex min-h-40 items-center justify-center rounded-xl border border-dashed px-6 text-center text-sm">
            No students found for this center.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Set status</TableHead>
                  <TableHead>Marking time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => {
                  const selected = draft[student.studentId] ?? "Absent"
                  return (
                    <TableRow key={student.studentId}>
                      <TableCell className="font-medium">
                        {student.fullName || "Unnamed student"}
                        {student.markedVia && (
                          <div className="text-muted-foreground text-xs capitalize">
                            via {student.markedVia}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {student.registrationNo}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("font-medium", statusBadgeClass(student.status))}
                        >
                          {student.status ?? "Not marked"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
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
                              )}
                              onClick={() => setStatus(student.studentId, option.value)}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {student.arrivalTime
                          ? formatLocalTime(student.arrivalTime, {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                              second: undefined,
                            })
                          : "--"}
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
  )
}
