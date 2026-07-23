"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getStoredUser } from "@/lib/api-client"
import { formatLocalTime } from "@/lib/format-time"
import { getTodayCenterAttendance } from "@/services/attendance"
import { listClassrooms } from "@/services/classroom"
import type { Attendance, Classroom, User } from "@/types"

const teacherNav = [{ href: "/teacher/dashboard", label: "Dashboard" }]

export default function TeacherDashboardPage() {
  const user = getStoredUser<User>()
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("")
  const [todayRecords, setTodayRecords] = useState<Attendance[]>([])
  const [todayDate, setTodayDate] = useState<string>("")
  const [loadingToday, setLoadingToday] = useState(true)

  const loadToday = useCallback(async () => {
    try {
      const data = await getTodayCenterAttendance()
      setTodayRecords(data.records)
      setTodayDate(data.date)
    } catch {
      toast.error("Failed to load today's attendance")
    } finally {
      setLoadingToday(false)
    }
  }, [])

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

    async function refresh() {
      try {
        const data = await getTodayCenterAttendance()
        if (!cancelled) {
          setTodayRecords(data.records)
          setTodayDate(data.date)
          setLoadingToday(false)
        }
      } catch {
        if (!cancelled) {
          setLoadingToday(false)
        }
      }
    }

    void refresh()
    const interval = setInterval(() => {
      void refresh()
    }, 5000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

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
                Point the camera at a student QR code to mark attendance automatically.
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
                    setTodayRecords((current) => {
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
                    void loadToday()
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
            <CardHeader>
              <CardTitle>Today&apos;s Attendance</CardTitle>
              <CardDescription>
                Students scanned today
                {todayDate ? ` · ${todayDate}` : ""} · {todayRecords.length} marked
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingToday ? (
                <p className="text-muted-foreground text-sm">Loading attendance...</p>
              ) : todayRecords.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No students scanned yet today. Use the live QR scanner to begin.
                </p>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todayRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.student_name || "Student"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {record.registration_no || "—"}
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
