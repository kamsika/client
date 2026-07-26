"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Search, Users } from "lucide-react"
import { toast } from "sonner"

import { AttendanceDatePicker } from "@/components/attendance-date-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getApiErrorMessage } from "@/lib/api-errors"
import { formatAttendanceDayLabel, formatLocalTime, localTodayISO } from "@/lib/format-time"
import { cn } from "@/lib/utils"
import { getTeacherAttendance } from "@/services/teacher"
import type {
  TeacherAttendanceHistoryRecord,
  TeacherAttendanceOverview,
} from "@/types"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

const fieldClass =
  "h-10 border-[#A2D4ED] bg-white transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const outlineBtn =
  "border-[#A2D4ED] text-[#0047AB] transition hover:bg-[#ABD2F2]/40"

const DEFAULT_GRADE_TABS = [
  "All",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "Grade 13",
]

function formatCheckInTime(timestamp: string | null) {
  if (!timestamp) return "—"
  return formatLocalTime(timestamp, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    second: undefined,
  })
}

function statusBadgeClass(status: TeacherAttendanceHistoryRecord["status"]) {
  if (status === "Present") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (status === "Late") return "border-amber-200 bg-amber-50 text-amber-900"
  return "border-rose-200 bg-rose-50 text-rose-800"
}

function recordKey(record: TeacherAttendanceHistoryRecord, index: number) {
  if (record.attendanceId != null) return `att-${record.attendanceId}`
  return `row-${record.studentId}-${record.subjectName ?? "none"}-${index}`
}

export function TeacherAttendanceHistory() {
  const [selectedDate, setSelectedDate] = useState(localTodayISO)
  const [selectedGrade, setSelectedGrade] = useState("All")
  const [selectedSubject, setSelectedSubject] = useState("All")
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [overview, setOverview] = useState<TeacherAttendanceOverview | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (opts?.silent) setRefreshing(true)
      else setLoading(true)

      try {
        const data = await getTeacherAttendance({
          date: selectedDate,
          grade: selectedGrade,
          subject: selectedSubject,
          search: debouncedQuery,
        })
        setOverview(data)
      } catch (error) {
        if (!opts?.silent) {
          setOverview(null)
          toast.error(getApiErrorMessage(error, "Failed to load attendance"))
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [debouncedQuery, selectedDate, selectedGrade, selectedSubject],
  )

  useEffect(() => {
    void load()
  }, [load])

  const gradeTabs = useMemo(() => {
    const fromApi = overview?.grades ?? []
    const merged = [...DEFAULT_GRADE_TABS]
    for (const grade of fromApi) {
      if (!merged.includes(grade) && grade !== "All") merged.push(grade)
    }
    return merged
  }, [overview?.grades])

  const subjectOptions = overview?.subjects ?? []
  const records = overview?.records ?? []
  const summary = overview?.summary
  const selectedGradeLabel =
    summary?.selectedGrade || overview?.selectedGrade || selectedGrade || "All"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#05082E]">
            Attendance History
          </h2>
          <p className="text-sm text-[#0047AB]/75">
            Grade-wise attendance for {formatAttendanceDayLabel(selectedDate)}. Filter by grade,
            subject, or student without reloading the page.
          </p>
        </div>
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
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className={cn(cardShell, "py-4")}>
          <CardHeader className="px-5 pb-1">
            <CardTitle className="text-xs font-medium tracking-wide text-[#0047AB]/75 uppercase">
              Present Today
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-2xl font-semibold text-emerald-700">
              {summary?.presentCount ?? 0}
            </p>
            <p className="text-xs text-[#0047AB]/70">Students marked Present / Late</p>
          </CardContent>
        </Card>
        <Card className={cn(cardShell, "py-4")}>
          <CardHeader className="px-5 pb-1">
            <CardTitle className="text-xs font-medium tracking-wide text-[#0047AB]/75 uppercase">
              Absent Today
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-2xl font-semibold text-rose-700">{summary?.absentCount ?? 0}</p>
            <p className="text-xs text-[#0047AB]/70">Students with no check-in</p>
          </CardContent>
        </Card>
        <Card className={cn(cardShell, "py-4")}>
          <CardHeader className="px-5 pb-1">
            <CardTitle className="text-xs font-medium tracking-wide text-[#0047AB]/75 uppercase">
              Attendance Records
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-2xl font-semibold text-[#05082E]">
              {summary?.totalRecords ?? 0}
            </p>
            <p className="text-xs text-[#0047AB]/70">Subject-level Present / Late marks</p>
          </CardContent>
        </Card>
        <Card className={cn(cardShell, "py-4")}>
          <CardHeader className="px-5 pb-1">
            <CardTitle className="text-xs font-medium tracking-wide text-[#0047AB]/75 uppercase">
              Selected Grade
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <p className="flex items-center gap-2 text-2xl font-semibold text-[#05082E]">
              <Users className="size-5 text-[#0047AB]/70" />
              {selectedGradeLabel}
            </p>
            <p className="text-xs text-[#0047AB]/70">
              {summary?.totalStudents ?? 0} student
              {(summary?.totalStudents ?? 0) === 1 ? "" : "s"} in view
            </p>
          </CardContent>
        </Card>
      </div>

      <div className={cn(cardShell, "space-y-4 p-5")}>
        <div className="space-y-2">
          <Label className="text-[#05082E]">Grade</Label>
          <Tabs
            value={selectedGrade}
            onValueChange={(value) => value && setSelectedGrade(value)}
            className="w-full"
          >
            <TabsList
              variant="line"
              className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0"
            >
              {gradeTabs.map((grade) => (
                <TabsTrigger
                  key={grade}
                  value={grade}
                  className={cn(
                    "rounded-lg border border-transparent px-3 py-1.5 text-sm data-active:border-[#A2D4ED] data-active:bg-[#f8fbfe] data-active:text-[#05082E]",
                  )}
                >
                  {grade}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-[#05082E]">Date</Label>
            <AttendanceDatePicker
              id="teacher-attendance-history-date"
              value={selectedDate}
              onChange={setSelectedDate}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[#05082E]">Subject</Label>
            <Select
              value={selectedSubject}
              onValueChange={(value) => value && setSelectedSubject(value)}
            >
              <SelectTrigger className={cn(fieldClass, "w-full")}>
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All subjects</SelectItem>
                {subjectOptions.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[#05082E]">Search</Label>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#A2D4ED]" />
              <Input
                className={cn(fieldClass, "pl-9")}
                placeholder="Student name or ID…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={cn(cardShell, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#A2D4ED]/40 bg-[#f8fbfe] hover:bg-[#f8fbfe]">
                <TableHead className="text-[#0047AB]">Student Name</TableHead>
                <TableHead className="text-[#0047AB]">Student ID</TableHead>
                <TableHead className="text-[#0047AB]">Grade</TableHead>
                <TableHead className="text-[#0047AB]">Subject</TableHead>
                <TableHead className="text-[#0047AB]">Attendance Date</TableHead>
                <TableHead className="text-[#0047AB]">Attendance Time</TableHead>
                <TableHead className="text-[#0047AB]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-[#0047AB]/70">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Loading attendance…
                    </span>
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-[#0047AB]/70">
                    No attendance records match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record, index) => (
                  <TableRow
                    key={recordKey(record, index)}
                    className="border-[#A2D4ED]/30 hover:bg-[#A2D4ED]/10"
                  >
                    <TableCell className="font-medium text-[#05082E]">
                      {record.fullName || "Unnamed student"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[#0047AB]">
                      {record.registrationNo}
                    </TableCell>
                    <TableCell className="text-[#05082E]">{record.grade || "—"}</TableCell>
                    <TableCell className="text-[#05082E]">
                      {record.subjectName || record.subject_name || "—"}
                    </TableCell>
                    <TableCell className="text-[#0047AB]/80">
                      {record.date || selectedDate}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[#0047AB]/80">
                      {formatCheckInTime(record.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("font-medium", statusBadgeClass(record.status))}
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
