"use client"

import { startTransition, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { SubjectSelect } from "@/components/subject-select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { getApiErrorMessage } from "@/lib/api-errors"
import { cn } from "@/lib/utils"
import {
  createClassroom,
  getClassroom,
  updateClassroom,
  type ClassroomDetail,
} from "@/services/classroom"
import { listSubjects } from "@/services/subject"
import type { Classroom, Subject, TimetableSlot, User } from "@/types"

const fieldClass =
  "h-10 border-[#A2D4ED] bg-white transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const primaryBtn =
  "gap-2 bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white"

const outlineBtn =
  "border-[#A2D4ED] text-[#0047AB] transition hover:bg-[#ABD2F2]/40"

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

const GRADE_OPTIONS = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "Other",
] as const

type SubjectAssignment = {
  id: string
  subject: string
  teacherId: string
}

type TimetableRow = {
  id: string
  dayOfWeek: string
  startTime: string
  endTime: string
  subject: string
  teacherId: string
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyAssignment(): SubjectAssignment {
  return { id: newId(), subject: "", teacherId: "" }
}

function emptySlot(): TimetableRow {
  return {
    id: newId(),
    dayOfWeek: "Monday",
    startTime: "09:00",
    endTime: "10:00",
    subject: "",
    teacherId: "",
  }
}

function normalizeTime(value?: string | null) {
  const text = String(value || "").trim()
  if (text.length >= 5) return text.slice(0, 5)
  return text
}

function gradeFromClassroom(gradeValue?: string | null) {
  const grade = (gradeValue || "").trim()
  if (!grade) return { grade: "", customGrade: "" }
  if ((GRADE_OPTIONS as readonly string[]).includes(grade)) {
    return { grade, customGrade: "" }
  }
  return { grade: "Other", customGrade: grade }
}

function assignmentsFromClassroom(classroom: ClassroomDetail): SubjectAssignment[] {
  const rows = classroom.subject_teachers || []
  if (!rows.length) return [emptyAssignment()]
  return rows.map((item) => ({
    id: newId(),
    subject: item.subject || item.subjectName || "",
    teacherId: String(item.teacher_id ?? item.teacherId ?? ""),
  }))
}

function slotsFromTimetable(timetable?: TimetableSlot[]): TimetableRow[] {
  if (!timetable?.length) return [emptySlot()]
  return timetable.map((slot) => ({
    id: newId(),
    dayOfWeek: slot.dayOfWeek || slot.day_of_week || "Monday",
    startTime: normalizeTime(slot.startTime || slot.start_time) || "09:00",
    endTime: normalizeTime(slot.endTime || slot.end_time) || "10:00",
    subject: slot.subjectName || slot.subject_name || "",
    teacherId: String(slot.teacherId ?? slot.teacher_id ?? ""),
  }))
}

interface CreateClassroomDialogProps {
  teachers: User[]
  onCreated?: (classroom: Classroom) => void
  onUpdated?: (classroom: Classroom) => void
  /** When set, dialog edits this classroom (controlled via open/onOpenChange). */
  editClassroomId?: number | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CreateClassroomDialog({
  teachers,
  onCreated,
  onUpdated,
  editClassroomId = null,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CreateClassroomDialogProps) {
  const isEdit = editClassroomId != null
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isEdit ? Boolean(controlledOpen) : internalOpen

  function setOpen(next: boolean) {
    if (isEdit) controlledOnOpenChange?.(next)
    else setInternalOpen(next)
  }

  const [formReady, setFormReady] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [grade, setGrade] = useState("")
  const [customGrade, setCustomGrade] = useState("")
  const [assignments, setAssignments] = useState<SubjectAssignment[]>([emptyAssignment()])
  const [slots, setSlots] = useState<TimetableRow[]>([emptySlot()])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(false)

  const assignedSubjects = useMemo(
    () => assignments.map((item) => item.subject.trim()).filter(Boolean),
    [assignments],
  )

  const slotsByDay = useMemo(() => {
    const grouped: Record<string, TimetableRow[]> = {}
    for (const day of DAYS) grouped[day] = []
    for (const slot of slots) {
      const day = DAYS.includes(slot.dayOfWeek as (typeof DAYS)[number])
        ? slot.dayOfWeek
        : "Monday"
      grouped[day].push(slot)
    }
    for (const day of DAYS) {
      grouped[day].sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
    return grouped
  }, [slots])

  // Prefetch subjects so opening the dialog does not wait on the network.
  useEffect(() => {
    let cancelled = false
    setLoadingSubjects(true)
    void listSubjects()
      .then((items) => {
        if (!cancelled) setSubjects(items)
      })
      .catch(() => {
        /* refreshed again when dialog opens */
      })
      .finally(() => {
        if (!cancelled) setLoadingSubjects(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Mount the heavy form after the dialog shell opens so the click handler stays light.
  useEffect(() => {
    if (!open) {
      setFormReady(false)
      return
    }
    const timer = window.setTimeout(() => {
      startTransition(() => setFormReady(true))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function loadSubjects() {
      try {
        const items = await listSubjects()
        if (!cancelled) setSubjects(items)
      } catch {
        if (!cancelled) toast.error("Failed to load subjects")
      } finally {
        if (!cancelled) setLoadingSubjects(false)
      }
    }

    void loadSubjects()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || !isEdit || editClassroomId == null) return
    let cancelled = false

    async function loadClassroom() {
      setLoadingEdit(true)
      try {
        const classroom = await getClassroom(editClassroomId)
        if (cancelled) return
        const gradeState = gradeFromClassroom(classroom.grade)
        setName(classroom.name || "")
        setGrade(gradeState.grade)
        setCustomGrade(gradeState.customGrade)
        setAssignments(assignmentsFromClassroom(classroom))
        setSlots(slotsFromTimetable(classroom.timetable))
        setErrors({})
      } catch (error) {
        if (!cancelled) {
          toast.error(getApiErrorMessage(error, "Failed to load classroom"))
          setOpen(false)
        }
      } finally {
        if (!cancelled) setLoadingEdit(false)
      }
    }

    void loadClassroom()
    return () => {
      cancelled = true
    }
  }, [open, isEdit, editClassroomId])

  function handleSubjectCreated(subject: Subject) {
    setSubjects((current) => {
      if (current.some((item) => item.id === subject.id)) return current
      return [...current, subject].sort((a, b) => a.name.localeCompare(b.name))
    })
  }
  function resetForm() {
    setName("")
    setGrade("")
    setCustomGrade("")
    setAssignments([emptyAssignment()])
    setSlots([emptySlot()])
    setErrors({})
  }

  function updateAssignment(id: string, patch: Partial<SubjectAssignment>) {
    setAssignments((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  function updateSlot(id: string, patch: Partial<TimetableRow>) {
    setSlots((current) =>
      current.map((item) => {
        if (item.id !== id) return item
        const next = { ...item, ...patch }
        if (patch.subject !== undefined) {
          const match = assignments.find(
            (row) => row.subject.trim().toLowerCase() === patch.subject!.trim().toLowerCase(),
          )
          if (match?.teacherId) {
            next.teacherId = match.teacherId
          }
        }
        return next
      }),
    )
  }

  function addSlotForDay(dayOfWeek: string) {
    setSlots((current) => [
      ...current,
      {
        ...emptySlot(),
        dayOfWeek,
      },
    ])
  }

  function removeSlot(id: string) {
    setSlots((current) => {
      if (current.length <= 1) return current
      return current.filter((item) => item.id !== id)
    })
  }

  function validate() {
    const nextErrors: Record<string, string> = {}
    const resolvedGrade = grade === "Other" ? customGrade.trim() : grade.trim()

    if (!name.trim()) nextErrors.name = "Classroom name is required"
    if (!resolvedGrade) nextErrors.grade = "Grade is required"

    const cleanedAssignments = assignments
      .map((item) => ({
        subject: item.subject.trim(),
        teacherId: item.teacherId,
      }))
      .filter((item) => item.subject || item.teacherId)

    if (cleanedAssignments.length === 0) {
      nextErrors.assignments = "Add at least one subject with a teacher"
    } else {
      const seen = new Set<string>()
      for (const item of cleanedAssignments) {
        if (!item.subject) {
          nextErrors.assignments = "Every assignment needs a subject"
          break
        }
        if (!item.teacherId) {
          nextErrors.assignments = `Select a teacher for ${item.subject}`
          break
        }
        const key = item.subject.toLowerCase()
        if (seen.has(key)) {
          nextErrors.assignments = `Duplicate subject: ${item.subject}`
          break
        }
        seen.add(key)
      }
    }

    const cleanedSlots = slots.filter(
      (slot) => slot.subject.trim() || slot.startTime || slot.endTime,
    )
    if (cleanedSlots.length === 0) {
      nextErrors.timetable = "Add at least one timetable slot"
    } else {
      const assignedSubjects = new Set(
        cleanedAssignments.map((item) => item.subject.toLowerCase()).filter(Boolean),
      )
      for (const [index, slot] of cleanedSlots.entries()) {
        if (!slot.dayOfWeek) {
          nextErrors.timetable = `Slot ${index + 1}: select a day`
          break
        }
        if (!slot.subject.trim()) {
          nextErrors.timetable = `Slot ${index + 1}: select a subject`
          break
        }
        if (!assignedSubjects.has(slot.subject.trim().toLowerCase())) {
          nextErrors.timetable = `Slot ${index + 1}: subject must be assigned a teacher first`
          break
        }
        if (!slot.startTime || !slot.endTime) {
          nextErrors.timetable = `Slot ${index + 1}: start and end time are required`
          break
        }
        if (slot.endTime <= slot.startTime) {
          nextErrors.timetable = `Slot ${index + 1}: end time must be after start time`
          break
        }
        if (!slot.teacherId) {
          nextErrors.timetable = `Slot ${index + 1}: select a teacher`
          break
        }
      }
    }

    if (teachers.length === 0) {
      nextErrors.teachers = "Create at least one teacher before adding a classroom"
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSave() {
    if (!validate()) {
      toast.error("Please fix the form errors")
      return
    }

    const resolvedGrade = grade === "Other" ? customGrade.trim() : grade.trim()
    const subjectTeachers = assignments
      .filter((item) => item.subject.trim() && item.teacherId)
      .map((item) => ({
        subject: item.subject.trim(),
        teacher_id: Number(item.teacherId),
      }))

    const timetable = slots
      .filter((slot) => slot.subject.trim() && slot.startTime && slot.endTime)
      .map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        subjectName: slot.subject.trim(),
        startTime: slot.startTime,
        endTime: slot.endTime,
        teacherId: Number(slot.teacherId),
      }))

    const payload = {
      name: name.trim(),
      grade: resolvedGrade,
      subject_teachers: subjectTeachers,
      timetable,
    }

    setSaving(true)
    try {
      if (isEdit && editClassroomId != null) {
        const classroom = await updateClassroom(editClassroomId, payload)
        toast.success("Classroom updated successfully")
        onUpdated?.(classroom)
      } else {
        const classroom = await createClassroom(payload)
        toast.success("Classroom created with timetable")
        onCreated?.(classroom)
      }
      setOpen(false)
      resetForm()
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          isEdit ? "Failed to update classroom" : "Failed to create classroom",
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setFormReady(false)
          resetForm()
        }
      }}
    >
      {!isEdit ? (
        <DialogTrigger render={<Button className={cn("h-10", primaryBtn)} />}>
          <Plus className="size-4" />
          Create Classroom
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#A2D4ED]/40 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-[#05082E]">
            {isEdit ? "Edit Classroom" : "New Classroom"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update grade, subject teachers, and the weekly timetable for this classroom."
              : "Set up a grade classroom with subject teachers and a weekly timetable."}
          </DialogDescription>
        </DialogHeader>

        {!formReady || loadingEdit ? (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-[#0047AB]/70">
            <Loader2 className="size-4 animate-spin" />
            {loadingEdit ? "Loading classroom…" : "Loading form…"}
          </div>
        ) : (
        <div className="space-y-4">
          {/* Classroom Details */}
          <section className="rounded-2xl border border-[#A2D4ED]/50 bg-[#f8fbfe] p-4 shadow-[0_6px_18px_rgba(5,8,46,0.04)]">
            <h3 className="text-sm font-semibold text-[#05082E]">Classroom Details</h3>
            <p className="mt-0.5 text-xs text-[#0047AB]/70">Name and grade for this class group</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[#05082E]">Classroom Name</Label>
                <Input
                  className={cn(fieldClass, errors.name && "border-destructive")}
                  placeholder="e.g. Morning Batch A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {errors.name ? <p className="text-destructive text-xs">{errors.name}</p> : null}
              </div>
              <div className="space-y-2">
                <Label className="text-[#05082E]">Grade</Label>
                <Select value={grade || null} onValueChange={(value) => value && setGrade(value)}>
                  <SelectTrigger className={cn(fieldClass, "w-full", errors.grade && "border-destructive")}>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {grade === "Other" ? (
                  <Input
                    className={fieldClass}
                    placeholder="Enter grade / class level"
                    value={customGrade}
                    onChange={(e) => setCustomGrade(e.target.value)}
                  />
                ) : null}
                {errors.grade ? <p className="text-destructive text-xs">{errors.grade}</p> : null}
              </div>
            </div>
          </section>

          {/* Subject & Teacher Assignment */}
          <section className="rounded-2xl border border-[#A2D4ED]/50 bg-white p-4 shadow-[0_6px_18px_rgba(5,8,46,0.04)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#05082E]">Subject & Teacher Assignment</h3>
                <p className="text-xs text-[#0047AB]/70">
                  Each subject needs its own assigned teacher
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={outlineBtn}
                onClick={() => setAssignments((current) => [...current, emptyAssignment()])}
              >
                <Plus className="size-3.5" />
                Add Subject
              </Button>
            </div>

            {errors.teachers ? (
              <p className="text-destructive mt-2 text-xs">{errors.teachers}</p>
            ) : null}
            {errors.assignments ? (
              <p className="text-destructive mt-2 text-xs">{errors.assignments}</p>
            ) : null}

            <div className="mt-3 space-y-2">
              {loadingSubjects && subjects.length === 0 ? (
                <p className="text-xs text-[#0047AB]/70">Loading subjects…</p>
              ) : null}
              {assignments.map((row, index) => (
                <div
                  key={row.id}
                  className="grid gap-2 rounded-xl border border-[#A2D4ED]/40 bg-[#f8fbfe] p-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#0047AB]">Subject {index + 1}</Label>
                    <SubjectSelect
                      value={row.subject || null}
                      subjects={subjects}
                      teachers={teachers}
                      onSubjectCreated={handleSubjectCreated}
                      onValueChange={(subjectName, subject) => {
                        updateAssignment(row.id, {
                          subject: subjectName,
                          teacherId:
                            subject?.teacher_id || subject?.teacherId
                              ? String(subject.teacher_id ?? subject.teacherId)
                              : row.teacherId,
                        })
                      }}
                      placeholder="Select subject"
                      triggerClassName="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#0047AB]">Teacher</Label>
                    <Select
                      value={row.teacherId || null}
                      onValueChange={(value) => value && updateAssignment(row.id, { teacherId: value })}
                    >
                      <SelectTrigger className={cn(fieldClass, "w-full")}>
                        <SelectValue placeholder="Select teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={String(teacher.id)}>
                            {teacher.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      disabled={assignments.length <= 1}
                      onClick={() =>
                        setAssignments((current) => current.filter((item) => item.id !== row.id))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Weekly Timetable */}
          <section className="rounded-2xl border border-[#A2D4ED]/50 bg-white p-4 shadow-[0_6px_18px_rgba(5,8,46,0.04)]">
            <div>
              <h3 className="text-sm font-semibold text-[#05082E]">Weekly Timetable</h3>
              <p className="text-xs text-[#0047AB]/70">
                Grouped by day — add compact period rows under each day
              </p>
            </div>

            {errors.timetable ? (
              <p className="text-destructive mt-2 text-xs">{errors.timetable}</p>
            ) : null}

            <div className="mt-3 space-y-3">
              {DAYS.map((day) => {
                const daySlots = slotsByDay[day] ?? []
                return (
                  <div
                    key={day}
                    className="overflow-hidden rounded-xl border border-[#A2D4ED]/45 bg-white"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-[#A2D4ED]/35 bg-[#f4f7fb] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-[#05082E]">{day}</h4>
                        <span className="rounded-md bg-[#ABD2F2]/45 px-1.5 py-0.5 text-[10px] font-semibold text-[#0047AB]">
                          {daySlots.length} {daySlots.length === 1 ? "period" : "periods"}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(outlineBtn, "h-7 gap-1 px-2 text-xs")}
                        onClick={() => addSlotForDay(day)}
                      >
                        <Plus className="size-3" />
                        Add Slot
                      </Button>
                    </div>

                    {daySlots.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-[#0047AB]/60">
                        No periods yet. Click Add Slot to schedule classes for {day}.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <div className="hidden min-w-[520px] grid-cols-[1fr_1fr_1.3fr_1.5fr_auto] gap-2 border-b border-[#A2D4ED]/25 bg-[#f8fbfe] px-3 py-1.5 text-[10px] font-semibold tracking-wide text-[#0047AB] uppercase md:grid">
                          <span>Start</span>
                          <span>End</span>
                          <span>Subject</span>
                          <span>Teacher</span>
                          <span className="sr-only">Actions</span>
                        </div>

                        <div className="divide-y divide-[#A2D4ED]/25">
                          {daySlots.map((slot) => (
                            <div
                              key={slot.id}
                              className="grid grid-cols-1 gap-2 px-3 py-2.5 sm:grid-cols-2 md:min-w-[520px] md:grid-cols-[1fr_1fr_1.3fr_1.5fr_auto] md:items-center"
                            >
                              <div className="space-y-1 md:space-y-0">
                                <Label className="text-[10px] text-[#0047AB] md:hidden">Start</Label>
                                <Input
                                  type="time"
                                  className={cn(fieldClass, "h-9")}
                                  value={slot.startTime}
                                  onChange={(e) =>
                                    updateSlot(slot.id, { startTime: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-1 md:space-y-0">
                                <Label className="text-[10px] text-[#0047AB] md:hidden">End</Label>
                                <Input
                                  type="time"
                                  className={cn(fieldClass, "h-9")}
                                  value={slot.endTime}
                                  onChange={(e) =>
                                    updateSlot(slot.id, { endTime: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-1 sm:col-span-2 md:col-span-1 md:space-y-0">
                                <Label className="text-[10px] text-[#0047AB] md:hidden">
                                  Subject
                                </Label>
                                <SubjectSelect
                                  value={slot.subject || null}
                                  subjects={
                                    assignedSubjects.length
                                      ? subjects.filter((item) =>
                                          assignedSubjects.includes(item.name),
                                        )
                                      : subjects
                                  }
                                  teachers={teachers}
                                  onSubjectCreated={(subject) => {
                                    handleSubjectCreated(subject)
                                  }}
                                  onValueChange={(subjectName, subject) => {
                                    updateSlot(slot.id, {
                                      subject: subjectName,
                                      teacherId:
                                        subject?.teacher_id || subject?.teacherId
                                          ? String(subject.teacher_id ?? subject.teacherId)
                                          : slot.teacherId,
                                    })
                                  }}
                                  placeholder="Subject"
                                  triggerClassName="h-9"
                                  allowAdd={assignedSubjects.length === 0}
                                />
                              </div>
                              <div className="space-y-1 sm:col-span-2 md:col-span-1 md:space-y-0">
                                <Label className="text-[10px] text-[#0047AB] md:hidden">
                                  Teacher
                                </Label>
                                <Select
                                  value={slot.teacherId || null}
                                  onValueChange={(value) =>
                                    value && updateSlot(slot.id, { teacherId: value })
                                  }
                                >
                                  <SelectTrigger className={cn(fieldClass, "h-9 w-full")}>
                                    <SelectValue placeholder="Teacher" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {teachers.map((teacher) => (
                                      <SelectItem key={teacher.id} value={String(teacher.id)}>
                                        {teacher.full_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex justify-end sm:col-span-2 md:col-span-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="size-8 border-red-200 text-red-600 hover:bg-red-50"
                                  disabled={slots.length <= 1}
                                  onClick={() => removeSlot(slot.id)}
                                  aria-label={`Remove ${day} period`}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <Button
            type="button"
            className={cn("h-11 w-full", primaryBtn)}
            disabled={saving || loadingEdit}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {isEdit ? "Saving…" : "Creating…"}
              </>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Create Classroom"
            )}
          </Button>
        </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
