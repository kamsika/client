"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Scanner } from "@yudiel/react-qr-scanner"
import { QrCode } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { parseStudentQr } from "@/lib/parse-student-qr"
import { getClassroomAttendance, markAttendance } from "@/services/attendance"
import type { AttendanceRecord } from "@/types"

interface QrAttendanceDialogProps {
  classroomId: number
  classroomName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QrAttendanceDialog({
  classroomId,
  classroomName,
  open,
  onOpenChange,
}: QrAttendanceDialogProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [marking, setMarking] = useState(false)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const recentScansRef = useRef<Map<number, number>>(new Map())

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true)
    try {
      const data = await getClassroomAttendance(classroomId)
      setRecords(data.records)
    } catch {
      toast.error("Failed to load students for this classroom")
    } finally {
      setLoadingStudents(false)
    }
  }, [classroomId])

  useEffect(() => {
    if (!open) {
      setLastScan(null)
      recentScansRef.current.clear()
      return
    }
    loadStudents()
  }, [open, loadStudents])

  function resolveStudentId(parsed: ReturnType<typeof parseStudentQr>) {
    if (!parsed) return null

    if (parsed.studentId) {
      const match = records.find((record) => record.student.id === parsed.studentId)
      return match?.student.id ?? null
    }

    if (parsed.registrationNo) {
      const normalized = parsed.registrationNo.toLowerCase()
      const match = records.find(
        (record) => record.student.registration_no.toLowerCase() === normalized,
      )
      return match?.student.id ?? null
    }

    return null
  }

  async function handleScan(detectedCodes: { rawValue: string }[]) {
    if (marking || detectedCodes.length === 0) return

    const rawValue = detectedCodes[0]?.rawValue?.trim()
    if (!rawValue) return

    const parsed = parseStudentQr(rawValue)
    const studentId = resolveStudentId(parsed)
    if (!studentId) {
      toast.error("QR code does not match a student in this classroom")
      return
    }

    const now = Date.now()
    const lastMarkedAt = recentScansRef.current.get(studentId)
    if (lastMarkedAt && now - lastMarkedAt < 3000) {
      return
    }

    const student = records.find((record) => record.student.id === studentId)?.student
    const label = student?.full_name || student?.registration_no || "Student"

    setMarking(true)
    try {
      const result = await markAttendance(studentId, classroomId)
      recentScansRef.current.set(studentId, now)
      setLastScan(label)
      toast.success(
        result.attendance.status === "Late"
          ? `${label} marked late (${result.delta_minutes} min)`
          : `${label} marked ${result.attendance.status}`,
      )
      await loadStudents()
    } catch {
      toast.error(`Failed to mark attendance for ${label}`)
    } finally {
      setMarking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-4" />
            Scan QR Code for Attendance
          </DialogTitle>
          <DialogDescription>
            Point the camera at a student QR code for {classroomName}. Each scan marks the student
            present for today.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border bg-black">
            {open && !loadingStudents ? (
              <Scanner
                onScan={handleScan}
                onError={(error) => toast.error(error?.message ?? "Camera error")}
                constraints={{ facingMode: "environment" }}
                styles={{
                  container: { width: "100%", minHeight: 280 },
                  video: { width: "100%", objectFit: "cover" },
                }}
                scanDelay={500}
                allowMultiple
              />
            ) : (
              <div className="flex min-h-[280px] items-center justify-center text-sm text-white/80">
                {loadingStudents ? "Loading students..." : "Starting camera..."}
              </div>
            )}
          </div>

          {lastScan && (
            <p className="text-muted-foreground text-center text-sm">
              Last scanned: <span className="text-foreground font-medium">{lastScan}</span>
            </p>
          )}

          <p className="text-muted-foreground text-xs">
            QR codes can contain a student registration number (e.g. STU-2026-001) or student ID.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
