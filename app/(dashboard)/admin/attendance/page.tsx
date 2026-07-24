"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { AttendanceDatePicker } from "@/components/attendance-date-picker"
import { DashboardShell } from "@/components/dashboard-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { getAdminNav } from "@/lib/admin-nav"
import { getStoredUser } from "@/lib/api-client"
import { formatAttendanceDayLabel, formatLocalTime, localTodayISO } from "@/lib/format-time"
import { getCenterAttendance } from "@/services/attendance"
import { listClassrooms } from "@/services/classroom"
import type { Attendance, Classroom, User } from "@/types"

export default function AdminAttendancePage() {
  const user = getStoredUser<User>()
  const navItems = getAdminNav(false)

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("all")
  const [selectedDate, setSelectedDate] = useState(localTodayISO)
  const [records, setRecords] = useState<Attendance[]>([])
  const [attendanceDate, setAttendanceDate] = useState("")
  const [loading, setLoading] = useState(true)

  const isViewingToday = selectedDate === localTodayISO()

  const loadAttendance = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCenterAttendance({
        date: selectedDate,
        classroomId:
          selectedClassroomId !== "all" ? Number(selectedClassroomId) : undefined,
      })
      setRecords(data.records)
      setAttendanceDate(data.date)
    } catch {
      toast.error("Failed to load attendance")
    } finally {
      setLoading(false)
    }
  }, [selectedClassroomId, selectedDate])

  useEffect(() => {
    listClassrooms()
      .then(setClassrooms)
      .catch(() => toast.error("Failed to load classrooms"))
  }, [])

  useEffect(() => {
    void loadAttendance()
  }, [loadAttendance])

  useEffect(() => {
    if (!isViewingToday) return
    const interval = setInterval(() => {
      void loadAttendance()
    }, 10000)
    return () => clearInterval(interval)
  }, [isViewingToday, loadAttendance])

  return (
    <DashboardShell
      title="Attendance"
      navItems={navItems}
      allowedRoles={["institution_admin"]}
    >
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {isViewingToday ? "Today's Attendance" : "Attendance by Date"}
            </CardTitle>
            <CardDescription>
              Review scanned students for your center
              {user?.institution_id ? ` (#${user.institution_id})` : ""}. Default view is today;
              pick any past date to browse history.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <AttendanceDatePicker
              id="admin-attendance-date"
              value={selectedDate}
              onChange={setSelectedDate}
            />
            <div className="space-y-2">
              <Label htmlFor="admin-attendance-class">Classroom</Label>
              <Select
                value={selectedClassroomId}
                onValueChange={(value) => value && setSelectedClassroomId(value)}
              >
                <SelectTrigger id="admin-attendance-class" className="w-full">
                  <SelectValue placeholder="All classrooms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classrooms</SelectItem>
                  {classrooms.map((cls) => (
                    <SelectItem key={cls.id} value={String(cls.id)}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scanned students</CardTitle>
            <CardDescription>
              {formatAttendanceDayLabel(attendanceDate || selectedDate)} · {records.length} marked
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading attendance...</p>
            ) : records.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {isViewingToday
                  ? "No students scanned yet today."
                  : "No attendance records for this date."}
              </p>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {record.student_name || "Student"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {record.registration_no || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {record.classroom_name || `Class #${record.classroom_id}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={record.status === "Late" ? "destructive" : "default"}>
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatLocalTime(record.arrival_time)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
