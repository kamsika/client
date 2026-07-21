"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"

import { AttendanceToggle } from "@/components/attendance-toggle"
import { DashboardShell } from "@/components/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { downloadBlob } from "@/lib/download"
import { exportAttendancePdf, getClassroomAttendance, markAttendance } from "@/services/attendance"
import type { AttendanceRecord, Classroom } from "@/types"

const teacherNav = [{ href: "/teacher/dashboard", label: "Dashboard" }]

export default function ClassroomAttendancePage() {
  const params = useParams()
  const classroomId = Number(params.id)

  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [date, setDate] = useState("")
  const [loadingId, setLoadingId] = useState<number | null>(null)

  const loadAttendance = useCallback(async () => {
    try {
      const data = await getClassroomAttendance(classroomId)
      setClassroom(data.classroom)
      setRecords(data.records)
      setDate(data.date)
    } catch {
      toast.error("Failed to load attendance")
    }
  }, [classroomId])

  useEffect(() => {
    loadAttendance()
    const interval = setInterval(loadAttendance, 5000)
    return () => clearInterval(interval)
  }, [loadAttendance])

  async function handleMark(studentId: number, status?: string) {
    setLoadingId(studentId)
    try {
      const result = await markAttendance(studentId, classroomId, status)
      toast.success(
        result.attendance.status === "Late"
          ? `Marked late (${result.delta_minutes} min) — parent SMS triggered`
          : result.attendance.status === "Absent"
            ? "Marked absent — parent SMS triggered"
            : `Marked ${result.attendance.status}`
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
      const blob = await exportAttendancePdf(classroomId)
      downloadBlob(blob, `attendance_${classroomId}.pdf`)
    } catch {
      toast.error("Failed to export PDF")
    }
  }

  return (
    <DashboardShell title="Live Attendance" navItems={teacherNav} allowedRoles={["teacher"]}>
      <div className="grid gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{classroom?.name || "Classroom"}</CardTitle>
              <CardDescription>
                {date} · Schedule starts at {classroom?.schedule_start_time}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleExportPdf}>
              Export PDF
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {records.map(({ student, attendance }) => (
              <AttendanceToggle
                key={student.id}
                studentId={student.id}
                studentName={student.full_name || student.registration_no}
                attendance={attendance}
                loading={loadingId === student.id}
                onMark={handleMark}
              />
            ))}
            {records.length === 0 && (
              <p className="text-muted-foreground text-sm">No students enrolled in this institution.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
