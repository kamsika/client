"use client"

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
import { studentInitials } from "@/lib/student-qr-payload"
import type { Student } from "@/types"

function enrolledSubjects(student: Student): string[] {
  const fromRegistered = (student.registeredSubjects ?? student.registered_subjects ?? [])
    .map((item) => item.name)
    .filter(Boolean)
  if (fromRegistered.length > 0) return fromRegistered
  return student.enrolledSubjects ?? student.enrolled_subjects ?? []
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

interface ScannedStudentDetailsCardProps {
  student: Student
  marking?: boolean
  marked?: boolean
  onMarkAttendance: () => void
  onDismiss: () => void
}

export function ScannedStudentDetailsCard({
  student,
  marking = false,
  marked = false,
  onMarkAttendance,
  onDismiss,
}: ScannedStudentDetailsCardProps) {
  const subjects = enrolledSubjects(student)
  const name = student.full_name?.trim() || "Student"
  const grade =
    student.grade ||
    student.classroom?.grade ||
    student.classroomName ||
    student.classroom_name ||
    "—"
  const photo = photoUrl(student)

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
          <p className="text-xs font-medium tracking-wide text-[#0047AB]/70 uppercase">
            Registered Subjects
          </p>
          {subjects.length === 0 ? (
            <p className="text-sm text-[#0047AB]/70">No enrolled subjects on file.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject) => (
                <Badge
                  key={subject}
                  variant="outline"
                  className="gap-1 border-[#A2D4ED] bg-[#f8fbfe] px-2.5 py-1 text-sm font-medium text-[#05082E]"
                >
                  <Check className="size-3.5 text-emerald-600" />
                  {subject}
                </Badge>
              ))}
            </div>
          )}
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
              onClick={onMarkAttendance}
              disabled={marking}
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
