"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Camera, Loader2, RefreshCw, Users } from "lucide-react"
import { toast } from "sonner"

import { AttendanceDatePicker } from "@/components/attendance-date-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getApiErrorMessage } from "@/lib/api-errors"
import { formatAttendanceDayLabel, formatLocalTime, localTodayISO } from "@/lib/format-time"
import { cn } from "@/lib/utils"
import { getTeacherAttendance } from "@/services/teacher"
import type { TeacherAttendanceOverview, TeacherAttendanceStudentRow } from "@/types"

const POLL_MS = 8000

function formatCheckInTime(timestamp: string | null) {
  if (!timestamp) return "--"
  return formatLocalTime(timestamp, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    second: undefined,
  })
}

function statusBadgeClass(status: TeacherAttendanceStudentRow["status"]) {
  if (status === "Present") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800"
  }
  if (status === "Late") {
    return "border-amber-200 bg-amber-50 text-amber-900"
  }
  return "border-rose-200 bg-rose-50 text-rose-800"
}

function MetricCard({
  label,
  value,
  accent,
  loading,
}: {
  label: string
  value: number | null
  accent: string
  loading: boolean
}) {
  return (
    <div className={cn("rounded-xl border px-4 py-4 shadow-none", accent)}>
      <p className="text-xs font-medium tracking-wide uppercase opacity-80">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-black/10" />
      ) : (
        <p className="mt-1 text-3xl font-semibold tabular-nums">{value ?? 0}</p>
      )}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-lg border px-3 py-3">
          <div className="bg-muted h-9 w-9 animate-pulse rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-3 w-1/3 animate-pulse rounded" />
            <div className="bg-muted h-3 w-1/5 animate-pulse rounded" />
          </div>
          <div className="bg-muted h-5 w-20 animate-pulse rounded-full" />
          <div className="bg-muted h-3 w-16 animate-pulse rounded" />
        </div>
      ))}
    </div>
  )
}

export function TeacherAttendanceDashboard() {
  const [selectedDate, setSelectedDate] = useState(localTodayISO)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [overview, setOverview] = useState<TeacherAttendanceOverview | null>(null)

  const isToday = selectedDate === localTodayISO()

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (opts?.silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      try {
        const data = await getTeacherAttendance({ date: selectedDate })
        setOverview(data)
      } catch (error) {
        if (!opts?.silent) {
          setOverview(null)
          toast.error(getApiErrorMessage(error, "Failed to load attendance overview"))
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [selectedDate],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!isToday) return
    const interval = window.setInterval(() => {
      void load({ silent: true })
    }, POLL_MS)
    return () => window.clearInterval(interval)
  }, [isToday, load])

  const summary = overview?.summary
  const students = overview?.students ?? []

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Attendance Overview</CardTitle>
            <CardDescription>
              Live roster for {formatAttendanceDayLabel(selectedDate)}. Students without a check-in
              are marked Absent.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <AttendanceDatePicker
              id="teacher-overview-date"
              value={selectedDate}
              onChange={setSelectedDate}
              className="sm:w-48"
            />
            <Button
              type="button"
              variant="outline"
              disabled={loading || refreshing}
              onClick={() => void load()}
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
            <Link href="/teacher/attendance/kiosk">
              <Button
                type="button"
                className="w-full bg-emerald-600 text-white hover:bg-emerald-500 sm:w-auto"
              >
                <Camera className="size-4" />
                Launch Kiosk Scanner 📸
              </Button>
            </Link>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Total Students"
          value={summary?.totalStudents ?? null}
          accent="border-sky-200 bg-sky-50 text-sky-950"
          loading={loading}
        />
        <MetricCard
          label="Present Count 🟢"
          value={summary?.presentCount ?? null}
          accent="border-emerald-200 bg-emerald-50 text-emerald-950"
          loading={loading}
        />
        <MetricCard
          label="Absent Count 🔴"
          value={summary?.absentCount ?? null}
          accent="border-rose-200 bg-rose-50 text-rose-950"
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Student Attendance
          </CardTitle>
          <CardDescription>
            {loading
              ? "Loading students…"
              : `${students.length} student${students.length === 1 ? "" : "s"} · Late counted separately in the table`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton />
          ) : students.length === 0 ? (
            <div className="text-muted-foreground flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 text-center text-sm">
              <Users className="size-8 opacity-40" />
              <p className="font-medium text-foreground">No students found</p>
              <p>
                There are no active students for this center yet, or no classroom is assigned to
                your account.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check-in Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.studentId}>
                      <TableCell>
                        <div className="font-medium">
                          {student.fullName || "Unnamed student"}
                        </div>
                        {(student.grade || student.section) && (
                          <div className="text-muted-foreground text-xs">
                            {[student.grade, student.section].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {student.registrationNo}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("font-medium", statusBadgeClass(student.status))}
                        >
                          {student.status} {student.statusIndicator}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm tabular-nums">
                        {formatCheckInTime(student.timestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
