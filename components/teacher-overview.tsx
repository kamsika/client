"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  ClipboardList,
  Loader2,
  QrCode,
  RefreshCw,
  UserRoundX,
  Users,
  UserCheck,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getApiErrorMessage } from "@/lib/api-errors"
import { formatAttendanceDayLabel, formatLocalTime, localTodayISO } from "@/lib/format-time"
import { cn } from "@/lib/utils"
import { getTeacherAttendance } from "@/services/teacher"
import type { TeacherAttendanceOverview, TeacherAttendanceStudentRow } from "@/types"

const POLL_MS = 8000
const RECENT_LIMIT = 8

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

const outlineBtn =
  "border-[#A2D4ED] text-[#0047AB] transition hover:bg-[#ABD2F2]/40"

const primaryBtn =
  "gap-2 bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white"

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

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  label: string
  value: number | null
  icon: typeof Users
  tone: "blue" | "gold" | "green" | "rose"
  loading: boolean
}) {
  const tones = {
    blue: "bg-[#ABD2F2]/35 text-[#0047AB]",
    gold: "bg-[#F9BF15]/25 text-[#b45309]",
    green: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
  }

  return (
    <div className={cn(cardShell, "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[#0047AB]/70 uppercase">
            {label}
          </p>
          {loading ? (
            <div className="mt-2 h-9 w-16 animate-pulse rounded-lg bg-[#A2D4ED]/30" />
          ) : (
            <p className="mt-1 text-3xl font-semibold tabular-nums text-[#05082E]">
              {value ?? 0}
            </p>
          )}
        </div>
        <span
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-xl",
            tones[tone],
          )}
        >
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  )
}

/** High-level teacher home: summary cards + recent check-ins. */
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
  const presentTotal = summary
    ? summary.presentCount + (summary.lateCount ?? 0)
    : null

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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#05082E]">
            Dashboard Overview
          </h2>
          <p className="text-sm text-[#0047AB]/75">
            Today&apos;s attendance for {formatAttendanceDayLabel(today)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className={outlineBtn}
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
          <Link href="/teacher/dashboard/qr-scanner">
            <Button type="button" className={primaryBtn}>
              <QrCode className="size-4" />
              Open QR Scanner
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Students"
          value={summary?.totalStudents ?? null}
          icon={Users}
          tone="blue"
          loading={loading}
        />
        <SummaryCard
          label="Today's Attendance"
          value={presentTotal}
          icon={ClipboardList}
          tone="gold"
          loading={loading}
        />
        <SummaryCard
          label="Present Count"
          value={presentTotal}
          icon={UserCheck}
          tone="green"
          loading={loading}
        />
        <SummaryCard
          label="Absent Count"
          value={summary?.absentCount ?? null}
          icon={UserRoundX}
          tone="rose"
          loading={loading}
        />
      </div>

      <div className={cn(cardShell, "overflow-hidden")}>
        <div className="border-b border-[#A2D4ED]/40 px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-[#05082E]">
            <Activity className="size-4 text-[#E88D1D]" />
            Recent activity
          </h3>
          <p className="text-sm text-[#0047AB]/75">
            Latest check-ins from today. Use QR Scanner to mark more students.
          </p>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-xl border border-[#A2D4ED]/40 bg-[#f8fbfe] px-3 py-3"
                >
                  <div className="size-9 animate-pulse rounded-full bg-[#A2D4ED]/40" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-[#A2D4ED]/40" />
                    <div className="h-3 w-1/5 animate-pulse rounded bg-[#A2D4ED]/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#A2D4ED]/60 bg-[#f8fbfe] px-6 text-center text-sm text-[#0047AB]/75">
              <Activity className="size-8 text-[#A2D4ED]" />
              <p className="font-medium text-[#05082E]">No check-ins yet today</p>
              <p>Open QR Scanner to start marking attendance.</p>
              <Link href="/teacher/dashboard/qr-scanner" className="mt-2">
                <Button type="button" size="sm" className={primaryBtn}>
                  <QrCode className="size-4" />
                  Scan now
                </Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[#A2D4ED]/30 overflow-hidden rounded-xl border border-[#A2D4ED]/45 bg-white">
              {recentActivity.map((student) => (
                <li
                  key={`${student.studentId}-${student.timestamp}`}
                  className="flex items-center gap-3 px-3 py-3 transition hover:bg-[#A2D4ED]/10"
                >
                  <Avatar size="default">
                    <AvatarFallback className="bg-[#ABD2F2]/50 font-semibold text-[#0047AB]">
                      {initials(student.fullName, student.registrationNo)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#05082E]">
                      {student.fullName || "Unnamed student"}
                    </p>
                    <p className="truncate text-xs text-[#0047AB]/75">
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
                  <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-[#0047AB]/70">
                    {formatCheckInTime(student.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
