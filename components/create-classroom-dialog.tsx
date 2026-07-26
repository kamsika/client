"use client"

import { useMemo, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

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
import { DEFAULT_ENROLLABLE_SUBJECTS } from "@/lib/enrollable-subjects"
import { getApiErrorMessage } from "@/lib/api-errors"
import { cn } from "@/lib/utils"
import { createClassroom } from "@/services/classroom"
import type { Classroom, User } from "@/types"

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

interface CreateClassroomDialogProps {
  teachers: User[]
  onCreated: (classroom: Classroom) => void
}

export function CreateClassroomDialog({ teachers, onCreated }: CreateClassroomDialogProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [grade, setGrade] = useState("")
  const [customGrade, setCustomGrade] = useState("")
  const [assignments, setAssignments] = useState<SubjectAssignment[]>([emptyAssignment()])
  const [slots, setSlots] = useState<TimetableRow[]>([emptySlot()])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const subjectOptions = useMemo(() => {
    const fromAssignments = assignments.map((item) => item.subject.trim()).filter(Boolean)
    return Array.from(new Set([...DEFAULT_ENROLLABLE_SUBJECTS, ...fromAssignments]))
  }, [assignments])

  const teacherById = useMemo(() => {
    const map = new Map<number, User>()
    teachers.forEach((teacher) => map.set(teacher.id, teacher))
    return map
  }, [teachers])

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

  async function handleCreate() {
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

    setCreating(true)
    try {
      const classroom = await createClassroom({
        name: name.trim(),
        grade: resolvedGrade,
        subject_teachers: subjectTeachers,
        timetable,
      })
      toast.success("Classroom created with timetable")
      onCreated(classroom)
      setOpen(false)
      resetForm()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create classroom"))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      <DialogTrigger render={<Button className={cn("h-10", primaryBtn)} />}>
        <Plus className="size-4" />
        Create Classroom
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#A2D4ED]/40 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-[#05082E]">New Classroom</DialogTitle>
          <DialogDescription>
            Set up a grade classroom with subject teachers and a weekly timetable.
          </DialogDescription>
        </DialogHeader>

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
                <Select value={grade || undefined} onValueChange={(value) => value && setGrade(value)}>
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
              {assignments.map((row, index) => (
                <div
                  key={row.id}
                  className="grid gap-2 rounded-xl border border-[#A2D4ED]/40 bg-[#f8fbfe] p-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#0047AB]">Subject {index + 1}</Label>
                    <Select
                      value={row.subject || undefined}
                      onValueChange={(value) => value && updateAssignment(row.id, { subject: value })}
                    >
                      <SelectTrigger className={cn(fieldClass, "w-full")}>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjectOptions.map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className={fieldClass}
                      placeholder="Or type a custom subject"
                      value={
                        (DEFAULT_ENROLLABLE_SUBJECTS as readonly string[]).includes(row.subject)
                          ? ""
                          : row.subject
                      }
                      onChange={(e) => updateAssignment(row.id, { subject: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#0047AB]">Teacher</Label>
                    <Select
                      value={row.teacherId || undefined}
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#05082E]">Weekly Timetable</h3>
                <p className="text-xs text-[#0047AB]/70">
                  Day, time, subject, and teacher for each class period
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={outlineBtn}
                onClick={() => setSlots((current) => [...current, emptySlot()])}
              >
                <Plus className="size-3.5" />
                Add Timetable Slot
              </Button>
            </div>

            {errors.timetable ? (
              <p className="text-destructive mt-2 text-xs">{errors.timetable}</p>
            ) : null}

            <div className="mt-3 space-y-3">
              {slots.map((slot, index) => {
                const assignedSubjects = assignments
                  .map((item) => item.subject.trim())
                  .filter(Boolean)
                const teacherName = slot.teacherId
                  ? teacherById.get(Number(slot.teacherId))?.full_name
                  : null

                return (
                  <div
                    key={slot.id}
                    className="rounded-xl border border-[#A2D4ED]/40 bg-[#f8fbfe] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold tracking-wide text-[#0047AB] uppercase">
                        Slot {index + 1}
                        {teacherName ? ` · ${teacherName}` : ""}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8 border-red-200 text-red-600 hover:bg-red-50"
                        disabled={slots.length <= 1}
                        onClick={() => setSlots((current) => current.filter((item) => item.id !== slot.id))}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#0047AB]">Day</Label>
                        <Select
                          value={slot.dayOfWeek}
                          onValueChange={(value) => value && updateSlot(slot.id, { dayOfWeek: value })}
                        >
                          <SelectTrigger className={cn(fieldClass, "w-full")}>
                            <SelectValue />
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
                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#0047AB]">Start</Label>
                        <Input
                          type="time"
                          className={fieldClass}
                          value={slot.startTime}
                          onChange={(e) => updateSlot(slot.id, { startTime: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#0047AB]">End</Label>
                        <Input
                          type="time"
                          className={fieldClass}
                          value={slot.endTime}
                          onChange={(e) => updateSlot(slot.id, { endTime: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#0047AB]">Subject</Label>
                        <Select
                          value={slot.subject || undefined}
                          onValueChange={(value) => value && updateSlot(slot.id, { subject: value })}
                        >
                          <SelectTrigger className={cn(fieldClass, "w-full")}>
                            <SelectValue placeholder="Subject" />
                          </SelectTrigger>
                          <SelectContent>
                            {(assignedSubjects.length
                              ? assignedSubjects
                              : [...DEFAULT_ENROLLABLE_SUBJECTS]
                            ).map((subject) => (
                              <SelectItem key={subject} value={subject}>
                                {subject}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-[#0047AB]">Teacher</Label>
                        <Select
                          value={slot.teacherId || undefined}
                          onValueChange={(value) => value && updateSlot(slot.id, { teacherId: value })}
                        >
                          <SelectTrigger className={cn(fieldClass, "w-full")}>
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
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <Button
            type="button"
            className={cn("h-11 w-full", primaryBtn)}
            disabled={creating}
            onClick={() => void handleCreate()}
          >
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Classroom"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
