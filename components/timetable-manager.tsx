"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { CalendarDays, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

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
import { cn } from "@/lib/utils"
import { listClassrooms } from "@/services/classroom"
import { listStudents } from "@/services/student"
import { deleteTimetable, listTimetable, upsertTimetable } from "@/services/timetable"
import type { Classroom, Student, TimetableSlot } from "@/types"

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

type ScopeMode = "classroom" | "student"

const emptyForm = {
  dayOfWeek: "Monday",
  subjectName: "",
  startTime: "15:00",
  endTime: "16:00",
}

function slotDay(slot: TimetableSlot) {
  return slot.dayOfWeek || slot.day_of_week
}

function slotSubject(slot: TimetableSlot) {
  return slot.subjectName || slot.subject_name
}

function slotStart(slot: TimetableSlot) {
  return slot.startTime || slot.start_time
}

function slotEnd(slot: TimetableSlot) {
  return slot.endTime || slot.end_time
}

export function TimetableManager() {
  const [scopeMode, setScopeMode] = useState<ScopeMode>("classroom")
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classroomId, setClassroomId] = useState("")
  const [studentId, setStudentId] = useState("")

  const [slots, setSlots] = useState<TimetableSlot[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)

  const selectedLabel = useMemo(() => {
    if (scopeMode === "classroom") {
      return classrooms.find((c) => String(c.id) === classroomId)?.name ?? null
    }
    const student = students.find((s) => String(s.id) === studentId)
    if (!student) return null
    return student.full_name || student.registration_no
  }, [scopeMode, classrooms, classroomId, students, studentId])

  const grouped = useMemo(() => {
    const map = new Map<string, TimetableSlot[]>()
    for (const day of DAYS) map.set(day, [])
    for (const slot of slots) {
      const day = slotDay(slot)
      const list = map.get(day) ?? []
      list.push(slot)
      map.set(day, list)
    }
    for (const [day, list] of map) {
      list.sort((a, b) => slotStart(a).localeCompare(slotStart(b)))
      map.set(day, list)
    }
    return map
  }, [slots])

  useEffect(() => {
    let cancelled = false
    async function loadMeta() {
      setLoadingMeta(true)
      try {
        const [classroomItems, studentItems] = await Promise.all([
          listClassrooms(),
          listStudents(),
        ])
        if (cancelled) return
        setClassrooms(classroomItems)
        setStudents(studentItems)
        if (classroomItems.length > 0) {
          setClassroomId(String(classroomItems[0].id))
        }
        if (studentItems.length > 0) {
          setStudentId(String(studentItems[0].id))
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getApiErrorMessage(error, "Failed to load classrooms/students"))
        }
      } finally {
        if (!cancelled) setLoadingMeta(false)
      }
    }
    void loadMeta()
    return () => {
      cancelled = true
    }
  }, [])

  const loadSlots = useCallback(async () => {
    const params =
      scopeMode === "classroom"
        ? classroomId
          ? { classroomId: Number(classroomId) }
          : null
        : studentId
          ? { studentId: Number(studentId) }
          : null

    if (!params) {
      setSlots([])
      return
    }

    setLoadingSlots(true)
    try {
      const items = await listTimetable(params)
      setSlots(items)
    } catch (error) {
      setSlots([])
      toast.error(getApiErrorMessage(error, "Failed to load timetable"))
    } finally {
      setLoadingSlots(false)
    }
  }, [scopeMode, classroomId, studentId])

  useEffect(() => {
    void loadSlots()
  }, [loadSlots])

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  function startEdit(slot: TimetableSlot) {
    setEditingId(slot.id)
    setForm({
      dayOfWeek: slotDay(slot),
      subjectName: slotSubject(slot),
      startTime: slotStart(slot).slice(0, 5),
      endTime: slotEnd(slot).slice(0, 5),
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const subjectName = form.subjectName.trim()
    if (!subjectName) {
      toast.error("Subject name is required")
      return
    }
    if (!form.startTime || !form.endTime) {
      toast.error("Start and end times are required")
      return
    }
    if (form.endTime <= form.startTime) {
      toast.error("End time must be after start time")
      return
    }

    const target =
      scopeMode === "classroom"
        ? classroomId
          ? { classroomId: Number(classroomId) }
          : null
        : studentId
          ? { studentId: Number(studentId) }
          : null

    if (!target) {
      toast.error(scopeMode === "classroom" ? "Select a classroom" : "Select a student")
      return
    }

    setSaving(true)
    try {
      await upsertTimetable({
        id: editingId ?? undefined,
        ...target,
        dayOfWeek: form.dayOfWeek,
        subjectName,
        startTime: form.startTime,
        endTime: form.endTime,
      })
      toast.success(editingId ? "Slot updated" : "Slot added")
      resetForm()
      await loadSlots()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save timetable slot"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(slotId: number) {
    if (!window.confirm("Delete this timetable slot?")) return
    setDeletingId(slotId)
    try {
      await deleteTimetable(slotId)
      toast.success("Slot deleted")
      if (editingId === slotId) resetForm()
      await loadSlots()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete slot"))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4" />
            {editingId ? "Edit Slot" : "Add Slot"}
          </CardTitle>
          <CardDescription>
            Create or update schedule slots for a classroom or student.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-2">
              <Label>Assign to</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={scopeMode === "classroom" ? "default" : "outline"}
                  onClick={() => {
                    setScopeMode("classroom")
                    resetForm()
                  }}
                >
                  Classroom
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={scopeMode === "student" ? "default" : "outline"}
                  onClick={() => {
                    setScopeMode("student")
                    resetForm()
                  }}
                >
                  Student
                </Button>
              </div>
            </div>

            {scopeMode === "classroom" ? (
              <div className="space-y-2">
                <Label htmlFor="timetable-classroom">Classroom</Label>
                <Select
                  value={classroomId}
                  onValueChange={(value) => {
                    if (value) {
                      setClassroomId(value)
                      resetForm()
                    }
                  }}
                  disabled={loadingMeta}
                >
                  <SelectTrigger id="timetable-classroom">
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
            ) : (
              <div className="space-y-2">
                <Label htmlFor="timetable-student">Student</Label>
                <Select
                  value={studentId}
                  onValueChange={(value) => {
                    if (value) {
                      setStudentId(value)
                      resetForm()
                    }
                  }}
                  disabled={loadingMeta}
                >
                  <SelectTrigger id="timetable-student">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={String(student.id)}>
                        {student.full_name || student.registration_no} ({student.registration_no})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="timetable-day">Day of week</Label>
              <Select
                value={form.dayOfWeek}
                onValueChange={(value) => value && setForm((prev) => ({ ...prev, dayOfWeek: value }))}
              >
                <SelectTrigger id="timetable-day">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timetable-subject">Subject name</Label>
              <Input
                id="timetable-subject"
                placeholder="e.g. Chemistry"
                value={form.subjectName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, subjectName: event.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="timetable-start">Start time</Label>
                <Input
                  id="timetable-start"
                  type="time"
                  value={form.startTime}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, startTime: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timetable-end">End time</Label>
                <Input
                  id="timetable-end"
                  type="time"
                  value={form.endTime}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, endTime: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saving || loadingMeta}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : editingId ? (
                  "Update slot"
                ) : (
                  "Add slot"
                )}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4" />
            Weekly Schedule
          </CardTitle>
          <CardDescription>
            {selectedLabel
              ? `Assigned classes for ${selectedLabel}`
              : "Select a classroom or student to view their schedule."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSlots ? (
            <div className="text-muted-foreground flex min-h-48 items-center justify-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading schedule…
            </div>
          ) : slots.length === 0 ? (
            <div className="text-muted-foreground flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 text-center text-sm">
              <CalendarDays className="size-8 opacity-40" />
              <p className="font-medium text-foreground">No slots yet</p>
              <p>Add a subject and time range using the form.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {DAYS.map((day) => {
                const daySlots = grouped.get(day) ?? []
                return (
                  <div
                    key={day}
                    className={cn(
                      "rounded-xl border p-3",
                      daySlots.length === 0 && "bg-muted/20",
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{day}</h3>
                      <Badge variant="secondary">{daySlots.length}</Badge>
                    </div>
                    {daySlots.length === 0 ? (
                      <p className="text-muted-foreground text-xs">No classes</p>
                    ) : (
                      <ul className="space-y-2">
                        {daySlots.map((slot) => (
                          <li
                            key={slot.id}
                            className={cn(
                              "flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2",
                              editingId === slot.id && "border-emerald-400 ring-1 ring-emerald-200",
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{slotSubject(slot)}</p>
                              <p className="text-muted-foreground font-mono text-xs tabular-nums">
                                {slotStart(slot)} – {slotEnd(slot)}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                onClick={() => startEdit(slot)}
                                aria-label="Edit slot"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                disabled={deletingId === slot.id}
                                onClick={() => void handleDelete(slot.id)}
                                aria-label="Delete slot"
                              >
                                {deletingId === slot.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
