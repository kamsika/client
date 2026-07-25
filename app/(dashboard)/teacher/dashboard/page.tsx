"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { AttendanceDatePicker } from "@/components/attendance-date-picker"
import { AttendanceDayPanel } from "@/components/attendance-day-panel"
import { DashboardShell } from "@/components/dashboard-shell"
import { TeacherLiveQrScanner } from "@/components/teacher-live-qr-scanner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getStoredUser } from "@/lib/api-client"
import { formatAttendanceDayLabel, localTodayISO } from "@/lib/format-time"
import { listClassrooms } from "@/services/classroom"
import type { Classroom, User } from "@/types"

const teacherNav = [
  { href: "/teacher/dashboard", label: "Dashboard" },
  { href: "/teacher/attendance/reports", label: "Reports" },
]

export default function TeacherDashboardPage() {
  const user = getStoredUser<User>()
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState(localTodayISO)
  const [refreshToken, setRefreshToken] = useState(0)

  const isViewingToday = selectedDate === localTodayISO()
  const classroomId = selectedClassroomId ? Number(selectedClassroomId) : null

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
                  <Label>Classroom</Label>
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
                  classroomId={classroomId ?? undefined}
                  onMarked={() => {
                    if (!isViewingToday) {
                      setSelectedDate(localTodayISO())
                    }
                    setRefreshToken((token) => token + 1)
                  }}
                />
              )}

              {classrooms.length > 0 && selectedClassroomId && (
                <div className="grid gap-2">
                  <Link href={`/teacher/classroom/${selectedClassroomId}/attendance`}>
                    <Button variant="outline" className="w-full">
                      Open Manual Attendance
                    </Button>
                  </Link>
                  <Link href="/teacher/attendance/reports">
                    <Button variant="secondary" className="w-full">
                      Attendance Reports & Export
                    </Button>
                  </Link>
                </div>
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
                  Roster vs scans for {formatAttendanceDayLabel(selectedDate)}. Students without a
                  scan are listed as Absent.
                </CardDescription>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AttendanceDatePicker
                  id="teacher-attendance-date"
                  value={selectedDate}
                  onChange={setSelectedDate}
                />
                {classrooms.length > 1 && (
                  <div className="space-y-2">
                    <Label>Classroom</Label>
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
              </div>
            </CardHeader>
            <CardContent>
              {!classroomId ? (
                <p className="text-muted-foreground text-sm">
                  Select a classroom to view attendance stats and absentees.
                </p>
              ) : (
                <AttendanceDayPanel
                  classroomId={classroomId}
                  date={selectedDate}
                  allowMarkPresent
                  refreshToken={refreshToken}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}
