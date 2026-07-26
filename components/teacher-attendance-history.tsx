"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"

import { AttendanceDatePicker } from "@/components/attendance-date-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { getApiErrorMessage } from "@/lib/api-errors"
import { formatAttendanceDayLabel, formatLocalTime, localTodayISO } from "@/lib/format-time"
import { cn } from "@/lib/utils"
import { getTeacherAttendance } from "@/services/teacher"
import type { TeacherAttendanceOverview, TeacherAttendanceStudentRow } from "@/types"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

const fieldClass =
  "h-10 border-[#A2D4ED] bg-white transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const outlineBtn =
  "border-[#A2D4ED] text-[#0047AB] transition hover:bg-[#ABD2F2]/40"

type StatusFilter = "all" | "present" | "absent" | "late"

function formatCheckInTime(timestamp: string | null) {
  if (!timestamp) return "—"
  return formatLocalTime(timestamp, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    second: undefined,
  })
}

function statusBadgeClass(status: TeacherAttendanceStudentRow["status"]) {
  if (status === "Present") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (status === "Late") return "border-amber-200 bg-amber-50 text-amber-900"
  return "border-rose-200 bg-rose-50 text-rose-800"
}

function matchesStatus(status: TeacherAttendanceStudentRow["status"], filter: StatusFilter) {
  if (filter === "all") return true
  if (filter === "present") return status === "Present"
  if (filter === "late") return status === "Late"
  return status === "Absent"
}

export function TeacherAttendanceHistory() {
  const [selectedDate, setSelectedDate] = useState(localTodayISO)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [overview, setOverview] = useState<TeacherAttendanceOverview | null>(null)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (opts?.silent) setRefreshing(true)
      else setLoading(true)

      try {
        const data = await getTeacherAttendance({ date: selectedDate })
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
    [selectedDate],
  )

  useEffect(() => {
    void load()
  }, [load])

  const filteredStudents = useMemo(() => {
    const students = overview?.students ?? []
    const normalized = query.trim().toLowerCase()

    return students.filter((student) => {
      if (!matchesStatus(student.status, statusFilter)) return false
      if (!normalized) return true
      const name = (student.fullName || "").toLowerCase()
      const id = student.registrationNo.toLowerCase()
      const grade = (student.grade || "").toLowerCase()
      const classroom = (student.classroomName || "").toLowerCase()
      return (
        name.includes(normalized) ||
        id.includes(normalized) ||
        grade.includes(normalized) ||
        classroom.includes(normalized)
      )
    })
  }, [overview?.students, query, statusFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#05082E]">
            Attendance History
          </h2>
          <p className="text-sm text-[#0047AB]/75">
            Roster for {formatAttendanceDayLabel(selectedDate)}. Students without a check-in are
            marked Absent.
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

      <div className={cn(cardShell, "p-5")}>
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
            <Label className="text-[#05082E]">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => value && setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className={cn(fieldClass, "w-full")}>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[#05082E]">Search</Label>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#A2D4ED]" />
              <Input
                className={cn(fieldClass, "pl-9")}
                placeholder="Name, student ID, grade…"
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
                <TableHead className="text-[#0047AB]">Grade / Class</TableHead>
                <TableHead className="text-[#0047AB]">Date</TableHead>
                <TableHead className="text-[#0047AB]">Check-in</TableHead>
                <TableHead className="text-[#0047AB]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-[#0047AB]/70">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Loading attendance…
                    </span>
                  </TableCell>
                </TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-[#0047AB]/70">
                    No students match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow
                    key={student.studentId}
                    className="border-[#A2D4ED]/30 hover:bg-[#A2D4ED]/10"
                  >
                    <TableCell className="font-medium text-[#05082E]">
                      {student.fullName || "Unnamed student"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[#0047AB]">
                      {student.registrationNo}
                    </TableCell>
                    <TableCell className="text-[#05082E]">
                      {student.grade || student.classroomName || "—"}
                      {student.grade && student.classroomName
                        ? ` · ${student.classroomName}`
                        : ""}
                    </TableCell>
                    <TableCell className="text-[#0047AB]/80">{selectedDate}</TableCell>
                    <TableCell className="font-mono text-xs text-[#0047AB]/80">
                      {formatCheckInTime(student.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("font-medium", statusBadgeClass(student.status))}
                      >
                        {student.status}
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
