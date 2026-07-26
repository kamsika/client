"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, FileSpreadsheet, Loader2, RefreshCw, Search, Users } from "lucide-react"
import { toast } from "sonner"

import { TeacherAttendanceAnalytics } from "@/components/teacher-attendance-analytics"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getApiErrorMessage } from "@/lib/api-errors"
import {
  APP_DISPLAY_TIMEZONE,
  formatAttendanceDayLabel,
  localTodayISO,
  parseApiTimestamp,
} from "@/lib/format-time"
import { cn } from "@/lib/utils"
import {
  exportTeacherAttendanceCsv,
  exportTeacherAttendancePdf,
  getTeacherAttendance,
} from "@/services/teacher"
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

const filterLabelClass =
  "flex h-5 items-center text-sm font-medium leading-none text-[#05082E]"

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

const thClass =
  "h-11 px-3 align-middle text-xs font-semibold tracking-wide whitespace-nowrap text-[#0047AB] uppercase"

const tdClass = "h-12 px-3 align-middle text-sm"

function formatDateOnly(dateISO: string | null | undefined, fallbackISO: string) {
  const raw = String(dateISO || fallbackISO || "").trim()
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  const value = match?.[1] ?? ""
  if (!value) return "—"
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function formatMethod(record: TeacherAttendanceHistoryRecord) {
  const method =
    record.attendanceMethod ||
    record.attendance_method ||
    (record.markedVia === "qr"
      ? "QR"
      : record.markedVia === "manual"
        ? "Manual"
        : record.markedVia === "face"
          ? "Face"
          : null)
  return method || "—"
}

function formatTimeOnly(timestamp: string | null | undefined) {
  const date = parseApiTimestamp(timestamp)
  if (!date) return "—"

  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: APP_DISPLAY_TIMEZONE,
  }).formatToParts(date)

  const hour = parts.find((part) => part.type === "hour")?.value
  const minute = parts.find((part) => part.type === "minute")?.value
  const dayPeriod = parts.find((part) => part.type === "dayPeriod")?.value
  if (!hour || !minute) return "—"
  return dayPeriod ? `${hour}:${minute} ${dayPeriod}` : `${hour}:${minute}`
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
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null)
  const [overview, setOverview] = useState<TeacherAttendanceOverview | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const filterParams = useMemo(
    () => ({
      date: selectedDate,
      grade: selectedGrade,
      subject: selectedSubject,
      search: debouncedQuery,
    }),
    [debouncedQuery, selectedDate, selectedGrade, selectedSubject],
  )

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (opts?.silent) setRefreshing(true)
      else setLoading(true)

      try {
        const data = await getTeacherAttendance(filterParams)
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
    [filterParams],
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
  const gradesAttended =
    summary?.gradesAttended ??
    summary?.grades_attended ??
    overview?.analytics?.gradesAttendedCount ??
    overview?.analytics?.grades_attended_count ??
    0

  const dayLabel =
    selectedDate === localTodayISO() ? "Today" : formatAttendanceDayLabel(selectedDate)

  async function handleExport(format: "csv" | "pdf") {
    setExporting(format)
    try {
      if (format === "csv") await exportTeacherAttendanceCsv(filterParams)
      else await exportTeacherAttendancePdf(filterParams)
      toast.success(format === "csv" ? "Excel/CSV exported" : "PDF exported")
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Failed to export ${format.toUpperCase()}`))
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-[#05082E]">
            Attendance History
          </h2>
          <p className="mt-1 text-sm text-[#0047AB]/75">
            Grade & subject attendance for {dayLabel}. Search, filter, export, and review analytics.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className={outlineBtn}
            disabled={loading || exporting !== null}
            onClick={() => void handleExport("csv")}
          >
            {exporting === "csv" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            Export Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            className={outlineBtn}
            disabled={loading || exporting !== null}
            onClick={() => void handleExport("pdf")}
          >
            {exporting === "pdf" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Export PDF
          </Button>
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
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className={cn(cardShell, "gap-2 py-4")}>
          <CardHeader className="px-5 pb-0">
            <CardTitle className="text-xs font-medium tracking-wide text-[#0047AB]/75 uppercase">
              Total Attendance Records
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-2xl font-semibold tabular-nums text-[#05082E]">
              {summary?.totalRecords ?? 0}
            </p>
            <p className="mt-0.5 text-xs text-[#0047AB]/70">Subject-level Present / Late marks</p>
          </CardContent>
        </Card>
        <Card className={cn(cardShell, "gap-2 py-4")}>
          <CardHeader className="px-5 pb-0">
            <CardTitle className="text-xs font-medium tracking-wide text-[#0047AB]/75 uppercase">
              Total Present Students
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-2xl font-semibold tabular-nums text-emerald-700">
              {summary?.presentCount ?? 0}
            </p>
            <p className="mt-0.5 text-xs text-[#0047AB]/70">Unique students Present / Late</p>
          </CardContent>
        </Card>
        <Card className={cn(cardShell, "gap-2 py-4")}>
          <CardHeader className="px-5 pb-0">
            <CardTitle className="text-xs font-medium tracking-wide text-[#0047AB]/75 uppercase">
              Total Absent Students
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-2xl font-semibold tabular-nums text-rose-700">
              {summary?.absentCount ?? 0}
            </p>
            <p className="mt-0.5 text-xs text-[#0047AB]/70">Students with no check-in</p>
          </CardContent>
        </Card>
        <Card className={cn(cardShell, "gap-2 py-4")}>
          <CardHeader className="px-5 pb-0">
            <CardTitle className="text-xs font-medium tracking-wide text-[#0047AB]/75 uppercase">
              Total Grades Attended
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <p className="flex items-center gap-2 text-2xl font-semibold tabular-nums text-[#05082E]">
              <Users className="size-5 shrink-0 text-[#0047AB]/70" />
              {gradesAttended}
            </p>
            <p className="mt-0.5 truncate text-xs text-[#0047AB]/70">
              Filter: {selectedGradeLabel}
              {selectedSubject !== "All" ? ` · ${selectedSubject}` : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className={cn(cardShell, "space-y-4 p-4 sm:p-5")}>
        <div className="space-y-2">
          <Label className={filterLabelClass}>Grade</Label>
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
                  className="rounded-lg border border-transparent px-3 py-1.5 text-sm data-active:border-[#A2D4ED] data-active:bg-[#f8fbfe] data-active:text-[#05082E]"
                >
                  {grade}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="grid min-w-0 grid-rows-[1.25rem_2.5rem] items-center gap-2">
            <Label htmlFor="teacher-attendance-history-date" className={filterLabelClass}>
              Date
            </Label>
            <Input
              id="teacher-attendance-history-date"
              type="date"
              value={selectedDate}
              max={localTodayISO()}
              className={cn(
                fieldClass,
                "box-border h-10 w-full min-h-10 max-h-10 py-0 leading-none",
                "[&::-webkit-calendar-picker-indicator]:my-0 [&::-webkit-datetime-edit]:m-0 [&::-webkit-datetime-edit]:p-0",
              )}
              onChange={(event) => {
                const next = event.target.value
                if (!next) return
                const today = localTodayISO()
                setSelectedDate(next > today ? today : next)
              }}
            />
          </div>

          <div className="grid min-w-0 grid-rows-[1.25rem_2.5rem] items-center gap-2">
            <Label className={filterLabelClass}>Subject</Label>
            <Select
              value={selectedSubject}
              onValueChange={(value) => value && setSelectedSubject(value)}
            >
              <SelectTrigger className={cn(fieldClass, "h-10 w-full min-h-10 max-h-10")}>
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

          <div className="grid min-w-0 grid-rows-[1.25rem_2.5rem] items-center gap-2">
            <Label htmlFor="teacher-attendance-history-search" className={filterLabelClass}>
              Search
            </Label>
            <div className="relative h-10 w-full">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#A2D4ED]" />
              <Input
                id="teacher-attendance-history-search"
                className={cn(fieldClass, "h-10 w-full min-h-10 max-h-10 pl-9")}
                placeholder="Student name or ID…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="history" className="gap-4">
        <TabsList className="bg-[#f8fbfe]">
          <TabsTrigger value="history">History Table</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-0">
          <div className={cn(cardShell, "overflow-hidden")}>
            <Table className="min-w-[860px] table-fixed">
              <TableHeader className="bg-[#f8fbfe]">
                <TableRow className="border-[#A2D4ED]/40 hover:bg-[#f8fbfe]">
                  <TableHead className={cn(thClass, "w-[20%] text-left")}>Student Name</TableHead>
                  <TableHead className={cn(thClass, "w-[14%] text-left")}>Student ID</TableHead>
                  <TableHead className={cn(thClass, "w-[12%] text-center")}>Grade</TableHead>
                  <TableHead className={cn(thClass, "w-[16%] text-left")}>Subject</TableHead>
                  <TableHead className={cn(thClass, "w-[12%] text-left")}>Date</TableHead>
                  <TableHead className={cn(thClass, "w-[12%] text-left")}>Time</TableHead>
                  <TableHead className={cn(thClass, "w-[10%] text-center")}>Method</TableHead>
                  <TableHead className={cn(thClass, "w-[12%] text-center")}>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="h-28 text-center text-[#0047AB]/70">
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Loading attendance…
                      </span>
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="h-28 text-center text-[#0047AB]/70">
                      No attendance records match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record, index) => (
                    <TableRow
                      key={recordKey(record, index)}
                      className={cn(
                        "border-[#A2D4ED]/30",
                        index % 2 === 0 ? "bg-white" : "bg-[#f8fbfe]/70",
                        "hover:bg-[#A2D4ED]/15",
                      )}
                    >
                      <TableCell className={cn(tdClass, "text-left font-medium text-[#05082E]")}>
                        <span className="block truncate">
                          {record.fullName || "Unnamed student"}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(tdClass, "text-left font-mono text-xs text-[#0047AB]")}
                      >
                        <span className="block truncate">{record.registrationNo}</span>
                      </TableCell>
                      <TableCell className={cn(tdClass, "text-center text-[#05082E]")}>
                        <span className="block truncate">{record.grade || "—"}</span>
                      </TableCell>
                      <TableCell className={cn(tdClass, "text-left text-[#05082E]")}>
                        <span className="block truncate">
                          {record.subjectName || record.subject_name || "—"}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(tdClass, "text-left whitespace-nowrap text-[#0047AB]/85")}
                      >
                        {formatDateOnly(record.date, selectedDate)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          tdClass,
                          "text-left font-mono text-xs whitespace-nowrap text-[#0047AB]/85",
                        )}
                      >
                        {formatTimeOnly(record.timestamp)}
                      </TableCell>
                      <TableCell className={cn(tdClass, "text-center text-[#05082E]")}>
                        {formatMethod(record)}
                      </TableCell>
                      <TableCell className={cn(tdClass, "text-center")}>
                        <div className="flex justify-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "inline-flex min-w-[5.5rem] justify-center font-medium",
                              statusBadgeClass(record.status),
                            )}
                          >
                            {record.status}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          {loading ? (
            <div className={cn(cardShell, "flex h-48 items-center justify-center text-[#0047AB]/70")}>
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Loading analytics…
              </span>
            </div>
          ) : (
            <TeacherAttendanceAnalytics analytics={overview?.analytics} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
