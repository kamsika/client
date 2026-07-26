"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Activity, Loader2, RefreshCw, Users } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getApiErrorMessage } from "@/lib/api-errors"
import { formatAttendanceDayLabel, formatLocalTime, localTodayISO } from "@/lib/format-time"
import { cn } from "@/lib/utils"
import { getTeacherAttendance } from "@/services/teacher"
import type { TeacherAttendanceOverview, TeacherAttendanceStudentRow } from "@/types"

const POLL_MS = 8000
const RECENT_LIMIT = 8

function initials(name: string | null | undefined, fallback: string) {
  const source = (name || fallback).trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

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

/** High-level teacher home: summary cards + recent check-ins only. */
export function TeacherOverview() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [overview, setOverview] = useState<TeacherAttendanceOverview | null>(null)
  const today = localTodayISO()

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const data = await getTeacherAttendance({ date: today })
      setOverview(data)
    } catch (error) {
      if (!opts?.silent) {
        setOverview(null)
        toast.error(getApiErrorMessage(error, "Failed to load overview"))
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [today])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void load({ silent: true })
    }, POLL_MS)
    return () => window.clearInterval(interval)
  }, [load])

  const summary = overview?.summary

  const recentActivity = useMemo(() => {
    const students = overview?.students ?? []
    return students
      .filter((student) => student.status !== "Absent" && student.timestamp)
      .sort((a, b) => {
        const aTime = a.timestamp ? Date.parse(a.timestamp) : 0
        const bTime = b.timestamp ? Date.parse(b.timestamp) : 0
        return bTime - aTime
      })
      .slice(0, RECENT_LIMIT)
  }, [overview?.students])

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Overview</h2>
          <p className="text-muted-foreground text-sm">
            Today&apos;s attendance summary for {formatAttendanceDayLabel(today)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <Link href="/teacher/attendance">
            <Button type="button" variant="secondary">
              <Users className="size-4" />
              Full roster
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Total Students"
          value={summary?.totalStudents ?? null}
          accent="border-sky-200 bg-sky-50 text-sky-950"
          loading={loading}
        />
        <MetricCard
          label="Present"
          value={
            summary ? summary.presentCount + (summary.lateCount ?? 0) : null
          }
          accent="border-emerald-200 bg-emerald-50 text-emerald-950"
          loading={loading}
        />
        <MetricCard
          label="Absent"
          value={summary?.absentCount ?? null}
          accent="border-rose-200 bg-rose-50 text-rose-950"
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" />
            Recent activity
          </CardTitle>
          <CardDescription>
            Latest check-ins from today. Use the feature tabs above for scanning and marking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-lg border px-3 py-3"
                >
                  <div className="bg-muted h-9 w-9 animate-pulse rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="bg-muted h-3 w-1/3 animate-pulse rounded" />
                    <div className="bg-muted h-3 w-1/5 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-muted-foreground flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 text-center text-sm">
              <Activity className="size-8 opacity-40" />
              <p className="font-medium text-foreground">No check-ins yet today</p>
              <p>Mark attendance from QR Scanner, Face Attendance, or Manual Attendance.</p>
            </div>
          ) : (
            <ul className="divide-y rounded-xl border">
              {recentActivity.map((student) => (
                <li
                  key={`${student.studentId}-${student.timestamp}`}
                  className="flex items-center gap-3 px-3 py-3"
                >
                  <Avatar size="default">
                    <AvatarFallback className="bg-sky-100 font-semibold text-sky-900">
                      {initials(student.fullName, student.registrationNo)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {student.fullName || "Unnamed student"}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {student.registrationNo}
                      {student.classroomName ? ` · ${student.classroomName}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 font-medium", statusBadgeClass(student.status))}
                  >
                    {student.status}
                  </Badge>
                  <span className="text-muted-foreground w-20 shrink-0 text-right font-mono text-xs tabular-nums">
                    {formatCheckInTime(student.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
