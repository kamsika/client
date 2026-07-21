"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { DashboardShell } from "@/components/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { listClassrooms } from "@/services/classroom"
import type { Classroom } from "@/types"

const teacherNav = [{ href: "/teacher/dashboard", label: "Dashboard" }]

export default function TeacherDashboardPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])

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
              <Link href={`/teacher/classroom/${cls.id}/attendance`}>
                <Button>Mark Attendance</Button>
              </Link>
            </div>
          ))}
          {classrooms.length === 0 && (
            <p className="text-muted-foreground text-sm">No classrooms assigned yet.</p>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
