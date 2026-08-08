"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { ScannedStudentDetailsCard } from "@/components/scanned-student-details-card"
import { FeeSummaryCard } from "@/components/fee-summary-card"
import { getApiErrorMessage, isAlreadyScannedError } from "@/lib/api-errors"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { OFFLINE_ATTENDANCE_MESSAGE } from "@/lib/pwa"
import {
  processAttendance,
  type AttendanceMethod,
  type AttendanceScanResponse,
} from "@/services/attendance"
import type { Attendance, Student } from "@/types"
import { getStudentFeeSummary, type FeeSummary } from "@/services/tuition"

export type ScannerAttendanceComplete = {
  scannedId: string
  studentName: string
  registrationNo: string
  isAlready: boolean
  isSuccess: boolean
  attendance?: Attendance | null
  result: AttendanceScanResponse
}

interface ScannerAttendancePanelProps {
  /** Identified student id / registration no (same value QR would send). */
  scannedId: string
  student: Student
  /** QR or FACE — both hit processAttendance → /api/attendance/scan. */
  attendanceMethod: AttendanceMethod
  marked?: boolean
  onMarkedChange?: (marked: boolean) => void
  onStatus?: (status: string) => void
  onComplete?: (payload: ScannerAttendanceComplete) => void
  onDismiss: () => void
  onMarkingChange?: (marking: boolean) => void
  /** Status text after success/already (parent may reset preview). */
  idleStatusMessage?: string
}

/**
 * Shared post-identify attendance UI for QR and Face scanners.
 * Identification happens upstream; this only runs the existing attendance workflow.
 */
export function ScannerAttendancePanel({
  scannedId,
  student,
  attendanceMethod,
  marked = false,
  onMarkedChange,
  onStatus,
  onComplete,
  onDismiss,
  onMarkingChange,
  idleStatusMessage = "Ready for next student",
}: ScannerAttendancePanelProps) {
  const [marking, setMarking] = useState(false)
  const [localMarked, setLocalMarked] = useState(marked)
  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null)
  const [feeUnavailable, setFeeUnavailable] = useState(false)
  const online = useOnlineStatus()
  const isMarked = marked || localMarked

  useEffect(() => {
    if (attendanceMethod !== "QR") return
    let cancelled = false
    setFeeSummary(null)
    setFeeUnavailable(false)
    void getStudentFeeSummary(student.id)
      .then((summary) => { if (!cancelled) setFeeSummary(summary) })
      .catch(() => { if (!cancelled) setFeeUnavailable(true) })
    return () => { cancelled = true }
  }, [attendanceMethod, student.id])

  async function handleMarkAttendance(selection: {
    selectedSubjectIds: number[]
    selectedSubjects: string[]
  }) {
    if (isMarked || marking) return
    if (!online) {
      toast.error(OFFLINE_ATTENDANCE_MESSAGE)
      return
    }
    if (
      selection.selectedSubjectIds.length === 0 &&
      selection.selectedSubjects.length === 0
    ) {
      toast.error("Select at least one subject")
      return
    }

    const name = student.full_name || "Student"
    const regNo = student.registration_no || scannedId
    const methodLabel = attendanceMethod === "FACE" ? "FACE" : "QR"

    setMarking(true)
    onMarkingChange?.(true)
    onStatus?.(`Marking Present: ${name}…`)

    try {
      const result = await processAttendance({
        studentId: scannedId,
        selectedSubjects: selection.selectedSubjects,
        selectedSubjectIds: selection.selectedSubjectIds,
        attendanceMethod,
      })

      const attendance = result.attendance ?? result.data
      const newlyMarked = result.newlyMarkedSubjects ?? []
      const alreadyMarkedSubjects = result.alreadyMarkedSubjects ?? []
      const presentDetails = (result.presentNowDetails ?? []).map(
        (item) => item.label || `${item.subjectName ?? item.subject_name}`,
      )
      const alreadyDetails = (result.alreadyMarkedDetails ?? []).map(
        (item) =>
          item.label || `Already marked for ${item.subjectName ?? item.subject_name}.`,
      )

      const isAlready =
        result.status === "AlreadyMarked" ||
        (newlyMarked.length === 0 && alreadyMarkedSubjects.length > 0)
      const isSuccess =
        result.status === "Present" ||
        newlyMarked.length > 0 ||
        Boolean(attendance)

      setLocalMarked(true)
      onMarkedChange?.(true)

      if (isAlready) {
        onStatus?.(`Already marked: ${name}`)
        toast.message(
          <div className="space-y-1 text-sm">
            <p className="font-semibold">
              {name} · ID {regNo}
            </p>
            <p>
              {alreadyDetails[0] ||
                "Attendance already marked for this subject today."}
            </p>
          </div>,
        )
      } else if (isSuccess) {
        onStatus?.(`Marked Present: ${name}`)
        toast.success(
          <div className="space-y-1 text-sm">
            <p className="font-semibold">Attendance marked successfully · {methodLabel}</p>
            <p>
              Name: <span className="font-medium">{name}</span>
            </p>
            <p>
              Student ID: <span className="font-mono text-xs">{regNo}</span>
            </p>
            {(presentDetails.length > 0 || newlyMarked.length > 0) && (
              <p>
                {presentDetails.length > 0
                  ? presentDetails.join("; ")
                  : newlyMarked.join(", ")}
              </p>
            )}
          </div>,
        )
      } else {
        onStatus?.(`Scan completed for ${name}`)
        toast.message(result.message || "Attendance processed")
      }

      onComplete?.({
        scannedId,
        studentName: name,
        registrationNo: regNo,
        isAlready,
        isSuccess,
        attendance: attendance ?? null,
        result,
      })

      window.setTimeout(() => {
        onStatus?.(idleStatusMessage)
        onDismiss()
      }, 1800)
    } catch (error) {
      if (isAlreadyScannedError(error)) {
        setLocalMarked(true)
        onMarkedChange?.(true)
        onStatus?.(`Already marked: ${name}`)
        toast.message("Attendance already marked for this subject today.")
        window.setTimeout(() => {
          onStatus?.(idleStatusMessage)
          onDismiss()
        }, 1800)
      } else {
        const message = getApiErrorMessage(error, "Failed to mark attendance")
        onStatus?.(message)
        toast.error(message)
      }
    } finally {
      setMarking(false)
      onMarkingChange?.(false)
    }
  }

  return (
    <div className="space-y-3">
      {attendanceMethod === "QR" ? <FeeSummaryCard summary={feeSummary} unavailable={feeUnavailable} /> : null}
      <ScannedStudentDetailsCard
        student={student}
        marking={marking}
        marked={isMarked}
        actionDisabled={!online}
        actionDisabledReason={OFFLINE_ATTENDANCE_MESSAGE}
        onMarkAttendance={(selection) => void handleMarkAttendance(selection)}
        onDismiss={onDismiss}
      />
    </div>
  )
}
