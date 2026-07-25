"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"

import { AttendanceDatePicker } from "@/components/attendance-date-picker"
import { AttendanceSummaryStats } from "@/components/attendance-summary-stats"
import { AttendanceToggle } from "@/components/attendance-toggle"
import { DashboardShell } from "@/components/dashboard-shell"
import { StudentAttendanceHistoryDialog } from "@/components/student-attendance-history-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { downloadBlob } from "@/lib/download"
import { formatAttendanceDayLabel, localTodayISO } from "@/lib/format-time"
import { exportAttendancePdf, getClassroomAttendance, markAttendance } from "@/services/attendance"
import type { AttendanceRecord, AttendanceSummary, Classroom } from "@/types"

const teacherNav = [
  { href: "/teacher/dashboard", label: "Dashboard" },
  { href: "/teacher/attendance/reports", label: "Reports" },
]

export default function ClassroomAttendancePage() {
  const params = useParams()
  const classroomId = Number(params.id)

  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [summary, setSummary] = useState<AttendanceSummary | null>(null)
  const [selectedDate, setSelectedDate] = useState(localTodayISO)
  const [date, setDate] = useState("")
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [historyStudentId, setHistoryStudentId] = useState<number | null>(null)
  const [historyStudentLabel, setHistoryStudentLabel] = useState<string | null>(null)

  const isViewingToday = selectedDate === localTodayISO()

  const loadAttendance = useCallback(async () => {
    try {
      const data = await getClassroomAttendance(classroomId, selectedDate)
      setClassroom(data.classroom)
      setRecords(data.records)
      setSummary(data.summary)
      setDate(data.date)
    } catch {
      toast.error("Failed to load attendance")
    }
  }, [classroomId, selectedDate])

  useEffect(() => {
    let cancelled = false

    const refreshAttendance = async () => {
      try {
        const data = await getClassroomAttendance(classroomId, selectedDate)
        if (cancelled) return
        setClassroom(data.classroom)
        setRecords(data.records)
        setSummary(data.summary)
        setDate(data.date)
      } catch {
        if (!cancelled) {
          toast.error("Failed to load attendance")
        }
      }
    }

    void refreshAttendance()

    if (!isViewingToday) {
      return () => {
        cancelled = true
      }
    }

    const interval = setInterval(() => {
      void refreshAttendance()
    }, 5000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [classroomId, isViewingToday, selectedDate])

  async function handleMark(studentId: number, status?: string) {
    if (!isViewingToday) {
      toast.error("Manual marking is only available for today's date.")
      return
    }
    setLoadingId(studentId)
    try {
      const result = await markAttendance(studentId, classroomId, status)
      toast.success(
        result.attendance.status === "Late"
          ? `Marked late (${result.delta_minutes} min) — parent SMS triggered`
          : result.attendance.status === "Absent"
            ? "Marked absent — parent SMS triggered"
            : `Marked ${result.attendance.status}`,
      )
      await loadAttendance()
    } catch {
      toast.error("Failed to mark attendance")
    } finally {
      setLoadingId(null)
    }
  }

  async function handleExportPdf() {
    try {
      const blob = await exportAttendancePdf(classroomId, selectedDate)
      downloadBlob(blob, `attendance_${classroomId}_${selectedDate}.pdf`)
    } catch {
      toast.error("Failed to export PDF")
    }
  }

  return (
    <DashboardShell title="Live Attendance" navItems={teacherNav} allowedRoles={["teacher"]}>
      <div className="grid gap-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-4">
              <div>
                <CardTitle>{classroom?.name || "Classroom"}</CardTitle>
                <CardDescription>
                  {formatAttendanceDayLabel(date || selectedDate)} · Schedule starts at{" "}
                  {classroom?.schedule_start_time}
                </CardDescription>
              </div>
              <AttendanceDatePicker
                id="classroom-attendance-date"
                value={selectedDate}
                onChange={setSelectedDate}
                className="max-w-xs"
              />
            </div>
            <Button variant="outline" onClick={handleExportPdf}>
              Export PDF
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            <AttendanceSummaryStats summary={summary} />
            {!isViewingToday && (
              <p className="text-muted-foreground text-sm">
                Viewing a past date (read-only). Switch to today to mark Present/Absent.
              </p>
            )}
            {records.map(({ student, attendance }) => (
              <AttendanceToggle
                key={student.id}
                studentId={student.id}
                studentName={student.full_name || student.registration_no}
                attendance={attendance}
                loading={loadingId === student.id}
                disabled={!isViewingToday}
                onMark={handleMark}
                onNameClick={(id) => {
                  setHistoryStudentId(id)
                  setHistoryStudentLabel(student.full_name || student.registration_no)
                }}
              />
            ))}
            {records.length === 0 && (
              <p className="text-muted-foreground text-sm">No active students enrolled in this institution.</p>
            )}
          </CardContent>
        </Card>

        <StudentAttendanceHistoryDialog
          studentId={historyStudentId}
          studentLabel={historyStudentLabel}
          classroomId={classroomId}
          open={historyStudentId !== null}
          onOpenChange={(next) => {
            if (!next) {
              setHistoryStudentId(null)
              setHistoryStudentLabel(null)
            }
          }}
        />
      </div>
    </DashboardShell>
  )
}
