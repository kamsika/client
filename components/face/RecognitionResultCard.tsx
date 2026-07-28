"use client"

import { AlertTriangle, CheckCircle2, HelpCircle, UserRound } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type RecognitionUiState =
  | "idle"
  | "scanning"
  | "recognized"
  | "already_marked"
  | "unknown"
  | "multiple_faces"
  | "no_face"

interface RecognitionResultCardProps {
  state: RecognitionUiState
  studentName?: string | null
  registrationNo?: string | null
  grade?: string | null
  classroomName?: string | null
  attendanceStatus?: string | null
  feeStatus?: string | null
  message?: string | null
  className?: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function RecognitionResultCard({
  state,
  studentName,
  registrationNo,
  grade,
  classroomName,
  attendanceStatus,
  feeStatus,
  message,
  className,
}: RecognitionResultCardProps) {
  const title =
    state === "recognized"
      ? studentName || "Student recognized"
      : state === "already_marked"
        ? "Attendance Already Recorded"
        : state === "unknown"
          ? "Unknown Student"
          : state === "multiple_faces"
            ? "Please stand one person at a time"
            : state === "no_face"
              ? "Face not visible"
              : state === "scanning"
                ? "Recognizing…"
                : "Ready to scan"

  const Icon =
    state === "recognized"
      ? CheckCircle2
      : state === "already_marked"
        ? AlertTriangle
        : state === "unknown" || state === "multiple_faces" || state === "no_face"
          ? HelpCircle
          : UserRound

  const tone =
    state === "recognized"
      ? "border-emerald-300/70 bg-emerald-50/80"
      : state === "already_marked"
        ? "border-sky-300/70 bg-sky-50/80"
        : state === "unknown" || state === "multiple_faces"
          ? "border-amber-300/70 bg-amber-50/80"
          : "border-[#A2D4ED]/60 bg-white"

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-[0_12px_40px_rgba(5,8,46,0.05)]",
        tone,
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {state === "recognized" && studentName ? (
          <Avatar size="lg">
            <AvatarFallback className="bg-[#ABD2F2]/60 text-[#0047AB]">
              {initials(studentName)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="flex size-12 items-center justify-center rounded-xl bg-[#A2D4ED]/40 text-[#0047AB]">
            <Icon className="size-6" />
          </span>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-lg font-semibold text-[#05082E]">{title}</h3>
          {message && <p className="text-sm text-[#0047AB]/80">{message}</p>}

          {state === "recognized" && (
            <dl className="grid gap-1.5 text-sm text-[#0047AB]/85">
              {registrationNo && (
                <div>
                  <span className="text-[#0047AB]/60">Student ID: </span>
                  <span className="font-mono font-medium text-[#05082E]">{registrationNo}</span>
                </div>
              )}
              {grade && (
                <div>
                  <span className="text-[#0047AB]/60">Grade: </span>
                  <span className="font-medium text-[#05082E]">{grade}</span>
                </div>
              )}
              {classroomName && (
                <div>
                  <span className="text-[#0047AB]/60">Classroom: </span>
                  <span className="font-medium text-[#05082E]">{classroomName}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {attendanceStatus && (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">{attendanceStatus}</Badge>
                )}
                {feeStatus && (
                  <Badge variant="outline" className="border-[#A2D4ED] text-[#0047AB]">
                    Fee: {feeStatus}
                  </Badge>
                )}
              </div>
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}
