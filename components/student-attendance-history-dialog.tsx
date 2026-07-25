"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatLocalTime } from "@/lib/format-time"
import { getStudentAttendance } from "@/services/attendance"
import type { Attendance, Student, StudentAttendanceHistorySummary } from "@/types"

interface StudentAttendanceHistoryDialogProps {
  studentId: number | null
  studentLabel?: string | null
  classroomId?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StudentAttendanceHistoryDialog({
  studentId,
  studentLabel,
  classroomId,
  open,
  onOpenChange,
}: StudentAttendanceHistoryDialogProps) {
  const [loading, setLoading] = useState(false)
  const [student, setStudent] = useState<Student | null>(null)
  const [records, setRecords] = useState<Attendance[]>([])
  const [summary, setSummary] = useState<StudentAttendanceHistorySummary | null>(null)

  useEffect(() => {
    if (!open || !studentId) return

    let cancelled = false
    setLoading(true)

    getStudentAttendance(studentId, {
      classroomId: classroomId ?? undefined,
    })
      .then((data) => {
        if (cancelled) return
        setStudent(data.student)
        setRecords(data.attendance)
        setSummary(data.summary)
      })
      .catch(() => {
        if (cancelled) return
        toast.error("Failed to load student attendance history")
        setStudent(null)
        setRecords([])
        setSummary(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, studentId, classroomId])

  const displayName =
    student?.full_name || studentLabel || (studentId ? `Student #${studentId}` : "Student")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Attendance History</DialogTitle>
          <DialogDescription>
            {displayName}
            {student?.registration_no ? ` · ${student.registration_no}` : ""}
            {summary?.classroom_name ? ` · ${summary.classroom_name}` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading && !summary ? (
          <p className="text-muted-foreground text-sm">Loading history...</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HistoryStat label="Total Classes Held" value={summary?.total_classes} />
              <HistoryStat label="Total Present" value={summary?.total_present} />
              <HistoryStat label="Total Absent" value={summary?.total_absent} />
              <HistoryStat
                label="Attendance %"
                value={summary ? `${summary.percentage}%` : undefined}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
              {records.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">
                  No attendance records found for this student
                  {summary?.classroom_name ? ` in ${summary.classroom_name}` : ""}.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Classroom</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.date}</TableCell>
                        <TableCell>{record.classroom_name || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              record.status === "Absent" || record.status === "Late"
                                ? "destructive"
                                : "default"
                            }
                          >
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatLocalTime(record.arrival_time)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function HistoryStat({
  label,
  value,
}: {
  label: string
  value: number | string | undefined | null
}) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? "—"}</p>
    </div>
  )
}
