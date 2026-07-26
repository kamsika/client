"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { AttendanceDatePicker } from "@/components/attendance-date-picker"
import { AttendanceDayPanel } from "@/components/attendance-day-panel"
import { AttendanceReportsPanel } from "@/components/attendance-reports-panel"
import { InstitutionAdminShell } from "@/components/institution-admin-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getAdminNav } from "@/lib/admin-nav"
import { getStoredUser } from "@/lib/api-client"
import { formatAttendanceDayLabel, localTodayISO } from "@/lib/format-time"
import { listClassrooms } from "@/services/classroom"
import type { Classroom, User } from "@/types"

export default function AdminAttendancePage() {
  const user = getStoredUser<User>()
  const navItems = getAdminNav(false)

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState(localTodayISO)

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
    <InstitutionAdminShell
      title="Attendance"
      navItems={navItems}
      allowedRoles={["institution_admin"]}
    >
      <Tabs defaultValue="daily" className="grid gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="daily">Daily View</TabsTrigger>
            <TabsTrigger value="reports">Reports & Export</TabsTrigger>
          </TabsList>
          <Link
            href="/admin/attendance/reports"
            className="border-border bg-background hover:bg-muted inline-flex h-7 items-center rounded-lg border px-2.5 text-[0.8rem] font-medium"
          >
            Open Reports Page
          </Link>
        </div>

        <TabsContent value="daily" className="mt-0 grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {isViewingToday ? "Today's Attendance" : "Attendance by Date"}
              </CardTitle>
              <CardDescription>
                Compare the active student roster against scans for your center
                {user?.institution_id ? ` (#${user.institution_id})` : ""}. Students without a
                record for the selected class and date are shown as Absent. Click a student name to
                view full attendance history.
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Class attendance overview</CardTitle>
              <CardDescription>
                {formatAttendanceDayLabel(selectedDate)}
                {classrooms.find((c) => String(c.id) === selectedClassroomId)
                  ? ` · ${classrooms.find((c) => String(c.id) === selectedClassroomId)?.name}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!classroomId ? (
                <p className="text-muted-foreground text-sm">
                  {classrooms.length === 0
                    ? "No classrooms found. Create a classroom to track attendance."
                    : "Select a classroom to view summary stats and absentees."}
                </p>
              ) : (
                <AttendanceDayPanel classroomId={classroomId} date={selectedDate} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <AttendanceReportsPanel />
        </TabsContent>
      </Tabs>
    </InstitutionAdminShell>
  )
}
