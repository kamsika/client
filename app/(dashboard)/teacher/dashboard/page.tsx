"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { AttendanceDatePicker } from "@/components/attendance-date-picker"
import { DashboardShell } from "@/components/dashboard-shell"
import { TeacherLiveQrScanner } from "@/components/teacher-live-qr-scanner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getStoredUser } from "@/lib/api-client"
import { formatAttendanceDayLabel, formatLocalTime, localTodayISO } from "@/lib/format-time"
import { getCenterAttendance } from "@/services/attendance"
import { listClassrooms } from "@/services/classroom"
import type { Attendance, Classroom, User } from "@/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const teacherNav = [{ href: "/teacher/dashboard", label: "Dashboard" }]

export default function TeacherDashboardPage() {
  const user = getStoredUser<User>()
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("")
  const [filterClassroomId, setFilterClassroomId] = useState<string>("all")
  const [selectedDate, setSelectedDate] = useState(localTodayISO)
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([])
  const [attendanceDate, setAttendanceDate] = useState<string>("")
  const [loadingAttendance, setLoadingAttendance] = useState(true)

  const isViewingToday = selectedDate === localTodayISO()

  const loadAttendance = useCallback(async () => {
    try {
      const data = await getCenterAttendance({
        date: selectedDate,
        classroomId: filterClassroomId !== "all" ? Number(filterClassroomId) : undefined,
      })
      setAttendanceRecords(data.records)
      setAttendanceDate(data.date)
    } catch {
      toast.error("Failed to load attendance")
    } finally {
      setLoadingAttendance(false)
    }
  }, [filterClassroomId, selectedDate])

  useEffect(() => {
    listClassrooms()
      .then((items) => {
        setClassrooms(items)
        if (items.length > 0) {
          setSelectedClassroomId(String(items[0].id))
        }
      })
      .catch(() => toast.error("Failed to load classrooms"))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadingAttendance(true)

    async function refresh() {
      try {
        const data = await getCenterAttendance({
          date: selectedDate,
          classroomId: filterClassroomId !== "all" ? Number(filterClassroomId) : undefined,
        })
        if (!cancelled) {
          setAttendanceRecords(data.records)
          setAttendanceDate(data.date)
          setLoadingAttendance(false)
        }
      } catch {
        if (!cancelled) {
          setLoadingAttendance(false)
        }
      }
    }

    void refresh()

    // Live refresh only while viewing today's list.
    if (!isViewingToday) {
      return () => {
        cancelled = true
      }
    }

    const interval = setInterval(() => {
      void refresh()
    }, 5000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [filterClassroomId, isViewingToday, selectedDate])

  return (
    <DashboardShell title="Teacher Dashboard" navItems={teacherNav} allowedRoles={["teacher"]}>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Welcome{user?.full_name ? `, ${user.full_name}` : ""}</CardTitle>
            <CardDescription>
              Scan student QR codes for your center
              {user?.institution_id ? ` (center #${user.institution_id})` : ""}. Attendance is
              limited to students in your assigned center.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Live QR Scanner</CardTitle>
              <CardDescription>
                Point the camera at a student QR code to mark attendance automatically for today.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {classrooms.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Classroom</p>
                  <Select
                    value={selectedClassroomId}
                    onValueChange={(value) => value && setSelectedClassroomId(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select classroom" />
                    </SelectTrigger>
                    <SelectContent>
                      {classrooms.map((cls) => (
                        <SelectItem key={cls.id} value={String(cls.id)}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {classrooms.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No classroom assigned yet. Ask your center admin to create a classroom and assign
                  you as teacher.
                </p>
              ) : (
                <TeacherLiveQrScanner
                  classroomId={selectedClassroomId ? Number(selectedClassroomId) : undefined}
                  onMarked={(attendance) => {
                    if (!isViewingToday) {
                      setSelectedDate(localTodayISO())
                    }
                    setAttendanceRecords((current) => {
                      const without = current.filter(
                        (item) =>
                          !(
                            item.student_id === attendance.student_id &&
                            item.classroom_id === attendance.classroom_id &&
                            item.date === attendance.date
                          ),
                      )
                      return [attendance, ...without]
                    })
                    void loadAttendance()
                  }}
                />
              )}

              {classrooms.length > 0 && selectedClassroomId && (
                <Link href={`/teacher/classroom/${selectedClassroomId}/attendance`}>
                  <Button variant="outline" className="w-full">
                    Open Manual Attendance
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-4">
              <div>
                <CardTitle>
                  {isViewingToday ? "Today's Attendance" : "Attendance by Date"}
                </CardTitle>
                <CardDescription>
                  {formatAttendanceDayLabel(attendanceDate || selectedDate)} ·{" "}
                  {attendanceRecords.length} marked
                </CardDescription>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AttendanceDatePicker
                  id="teacher-attendance-date"
                  value={selectedDate}
                  onChange={(date) => {
                    setLoadingAttendance(true)
                    setSelectedDate(date)
                  }}
                />
                {classrooms.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Filter by class</p>
                    <Select
                      value={filterClassroomId}
                      onValueChange={(value) => {
                        if (!value) return
                        setLoadingAttendance(true)
                        setFilterClassroomId(value)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All classes</SelectItem>
                        {classrooms.map((cls) => (
                          <SelectItem key={cls.id} value={String(cls.id)}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingAttendance ? (
                <p className="text-muted-foreground text-sm">Loading attendance...</p>
              ) : attendanceRecords.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {isViewingToday
                    ? "No students scanned yet today. Use the live QR scanner to begin."
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
                      {attendanceRecords.map((record) => (
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
      </div>
    </DashboardShell>
  )
}
