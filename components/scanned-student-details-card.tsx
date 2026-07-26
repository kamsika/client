"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Loader2, X } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { studentInitials } from "@/lib/student-qr-payload"
import type { Student } from "@/types"

export type SelectableEnrolledSubject = {
  key: string
  id: number | null
  name: string
  alreadyMarked: boolean
}

function centerName(student: Student) {
  return (
    student.tuitionCenterName ||
    student.tuition_center_name ||
    student.institutionName ||
    student.institution_name ||
    "—"
  )
}

function photoUrl(student: Student) {
  return student.profilePhoto || student.profile_photo || student.photoUrl || student.photo_url || ""
}

export function getEnrolledSubjectOptions(student: Student): SelectableEnrolledSubject[] {
  const already = new Set(
    (student.alreadyMarkedSubjects ?? student.already_marked_subjects ?? []).map((name) =>
      name.trim().toLowerCase(),
    ),
  )
  const registered = student.registeredSubjects ?? student.registered_subjects ?? []
  if (registered.length > 0) {
    return registered
      .map((item) => {
        const name = item.name.trim()
        return {
          key: item.id != null ? `id:${item.id}` : `name:${name.toLowerCase()}`,
          id: item.id ?? null,
          name,
          alreadyMarked: already.has(name.toLowerCase()),
        }
      })
      .filter((item) => item.name)
  }

  return (student.enrolledSubjects ?? student.enrolled_subjects ?? []).map((name) => {
    const trimmed = name.trim()
    return {
      key: `name:${trimmed.toLowerCase()}`,
      id: null,
      name: trimmed,
      alreadyMarked: already.has(trimmed.toLowerCase()),
    }
  })
}

interface ScannedStudentDetailsCardProps {
  student: Student
  marking?: boolean
  marked?: boolean
  onMarkAttendance: (selection: {
    selectedSubjectIds: number[]
    selectedSubjects: string[]
  }) => void
  onDismiss: () => void
}

export function ScannedStudentDetailsCard({
  student,
  marking = false,
  marked = false,
  onMarkAttendance,
  onDismiss,
}: ScannedStudentDetailsCardProps) {
  const subjects = useMemo(() => getEnrolledSubjectOptions(student), [student])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  useEffect(() => {
    setSelectedKeys(subjects.filter((item) => !item.alreadyMarked).map((item) => item.key))
  }, [subjects])

  const name = student.full_name?.trim() || "Student"
  const grade =
    student.grade ||
    student.classroom?.grade ||
    student.classroomName ||
    student.classroom_name ||
    "—"
  const photo = photoUrl(student)
  const selectableCount = subjects.filter((item) => !item.alreadyMarked).length
  const feeInfo =
    student.currentMonthFee ||
    student.current_month_fee ||
    student.monthlyPayment ||
    student.monthly_payment ||
    null
  const feeStatus = (
    feeInfo?.paymentStatus ||
    feeInfo?.payment_status ||
    student.paymentStatus ||
    student.payment_status ||
    "Pending"
  ).trim()
  const feePending = feeStatus !== "Paid"
  const feeAmount = feeInfo?.amount ?? feeInfo?.amount_due ?? feeInfo?.amountDue ?? null
  const feeMonthLabel = feeInfo?.monthName || feeInfo?.month_name || null

  function toggleSubject(key: string, disabled: boolean) {
    if (disabled || marking || marked) return
    setSelectedKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    )
  }

  function handleMark() {
    const selected = subjects.filter((item) => selectedKeys.includes(item.key) && !item.alreadyMarked)
    onMarkAttendance({
      selectedSubjectIds: selected
        .map((item) => item.id)
        .filter((id): id is number => typeof id === "number"),
      selectedSubjects: selected.map((item) => item.name),
    })
  }

  return (
    <Card className="border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)] ring-[#A2D4ED]/40">
      <CardHeader className="border-b border-[#A2D4ED]/35 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-14 border border-[#A2D4ED]/60 bg-[#f8fbfe] text-[#05082E]">
              {photo ? <AvatarImage src={photo} alt={name} /> : null}
              <AvatarFallback className="bg-[#A2D4ED]/25 text-base font-semibold text-[#05082E]">
                {studentInitials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="truncate text-lg text-[#05082E]">{name}</CardTitle>
              <CardDescription className="font-mono text-[#0047AB]/80">
                {student.registration_no}
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-[#0047AB]/70 hover:text-[#05082E]"
            onClick={onDismiss}
            aria-label="Dismiss student details"
          >
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium tracking-wide text-[#0047AB]/70 uppercase">
              Student Name
            </dt>
            <dd className="mt-1 text-sm font-medium text-[#05082E]">{name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-[#0047AB]/70 uppercase">
              Student ID
            </dt>
            <dd className="mt-1 font-mono text-sm font-medium text-[#05082E]">
              {student.registration_no}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-[#0047AB]/70 uppercase">
              Grade / Class
            </dt>
            <dd className="mt-1 text-sm font-medium text-[#05082E]">{grade}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-[#0047AB]/70 uppercase">
              Tuition Center
            </dt>
            <dd className="mt-1 text-sm font-medium text-[#05082E]">{centerName(student)}</dd>
          </div>
        </dl>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium tracking-wide text-[#0047AB]/70 uppercase">
              Today&apos;s Class
            </p>
            <p className="text-xs text-[#0047AB]/70">Select subject(s) attending now</p>
          </div>

          {subjects.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#A2D4ED]/60 bg-[#f8fbfe] px-3 py-4 text-sm text-[#0047AB]/75">
              No enrolled subjects on file for this student.
            </p>
          ) : (
            <ul className="space-y-2">
              {subjects.map((subject) => {
                const checked = selectedKeys.includes(subject.key)
                const disabled = subject.alreadyMarked || marking || marked
                return (
                  <li key={subject.key}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors",
                        subject.alreadyMarked
                          ? "border-amber-200 bg-amber-50/70"
                          : checked
                            ? "border-[#05082E]/30 bg-[#f8fbfe]"
                            : "border-[#A2D4ED]/60 bg-white hover:bg-[#f8fbfe]",
                        disabled && !subject.alreadyMarked ? "opacity-70" : null,
                      )}
                    >
                      <Checkbox
                        checked={checked || subject.alreadyMarked}
                        disabled={disabled}
                        onCheckedChange={() => toggleSubject(subject.key, disabled)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#05082E]">{subject.name}</p>
                        {subject.alreadyMarked ? (
                          <p className="text-xs text-amber-700">Already marked today</p>
                        ) : null}
                      </div>
                      {subject.alreadyMarked ? (
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-100 text-amber-800"
                        >
                          Done
                        </Badge>
                      ) : null}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-[#A2D4ED]/60 bg-[#f8fbfe] px-3 py-3">
          <p className="text-xs font-medium tracking-wide text-[#0047AB]/70 uppercase">
            Fee Status
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-[#05082E]">Current Month Fee:</p>
            {feeStatus === "Paid" ? (
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-800"
              >
                Paid ✅
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">
                Pending ⚠️
              </Badge>
            )}
          </div>
          {feeAmount != null ? (
            <p className="mt-1 text-xs text-[#0047AB]/75">
              Amount: {Number(feeAmount).toLocaleString()}
              {feeMonthLabel ? ` · ${feeMonthLabel}` : ""}
            </p>
          ) : null}
          {feePending ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
              Fee payment pending. Attendance can still be marked.
            </p>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 border-t border-[#A2D4ED]/35 py-4 sm:flex-row">
        {marked ? (
          <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700">
            <Check className="size-4" />
            Attendance marked successfully
          </div>
        ) : (
          <>
            <Button
              type="button"
              className="w-full flex-1 bg-[#05082E] text-white hover:bg-[#05082E]/90"
              onClick={handleMark}
              disabled={
                marking ||
                subjects.length === 0 ||
                selectableCount === 0 ||
                selectedKeys.filter((key) =>
                  subjects.some((item) => item.key === key && !item.alreadyMarked),
                ).length === 0
              }
            >
              {marking ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Marking…
                </>
              ) : (
                "Mark Attendance"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full flex-1 border-[#A2D4ED] text-[#0047AB]"
              onClick={onDismiss}
              disabled={marking}
            >
              Cancel
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
