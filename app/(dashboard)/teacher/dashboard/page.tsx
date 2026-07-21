"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { QrCode } from "lucide-react"
import { toast } from "sonner"

import { DashboardShell } from "@/components/dashboard-shell"
import { QrAttendanceDialog } from "@/components/qr-attendance-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { listClassrooms } from "@/services/classroom"
import type { Classroom } from "@/types"

const teacherNav = [{ href: "/teacher/dashboard", label: "Dashboard" }]

export default function TeacherDashboardPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [qrClassroom, setQrClassroom] = useState<Classroom | null>(null)

  useEffect(() => {
    listClassrooms()
      .then(setClassrooms)
      .catch(() => toast.error("Failed to load classrooms"))
  }, [])

  return (
    <DashboardShell title="Teacher Dashboard" navItems={teacherNav} allowedRoles={["teacher"]}>
      <Card>
        <CardHeader>
          <CardTitle>Your Classrooms</CardTitle>
          <CardDescription>Select a classroom to mark real-time attendance</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {classrooms.map((cls) => (
            <div key={cls.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div>
                <p className="font-medium">{cls.name}</p>
                <p className="text-muted-foreground text-sm">Starts at {cls.schedule_start_time}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setQrClassroom(cls)}>
                  <QrCode className="size-4" />
                  Scan QR for Attendance
                </Button>
                <Link href={`/teacher/classroom/${cls.id}/attendance`}>
                  <Button>Mark Attendance</Button>
                </Link>
              </div>
            </div>
          ))}
          {classrooms.length === 0 && (
            <p className="text-muted-foreground text-sm">No classrooms assigned yet.</p>
          )}
        </CardContent>
      </Card>

      {qrClassroom && (
        <QrAttendanceDialog
          classroomId={qrClassroom.id}
          classroomName={qrClassroom.name}
          open={Boolean(qrClassroom)}
          onOpenChange={(open) => {
            if (!open) setQrClassroom(null)
          }}
        />
      )}
    </DashboardShell>
  )
}
