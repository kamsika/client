"use client"

import Link from "next/link"
import { Camera } from "lucide-react"

import { DashboardShell } from "@/components/dashboard-shell"
import { TeacherAttendanceDashboard } from "@/components/teacher-attendance-dashboard"
import { TeacherLiveQrScanner } from "@/components/teacher-live-qr-scanner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getStoredUser } from "@/lib/api-client"
import type { User } from "@/types"

const teacherNav = [
  { href: "/teacher/dashboard", label: "Dashboard" },
  { href: "/teacher/attendance", label: "Attendance" },
  { href: "/teacher/attendance/kiosk", label: "Face Kiosk" },
  { href: "/teacher/attendance/reports", label: "Reports" },
]

export default function TeacherDashboardPage() {
  const user = getStoredUser<User>()

  return (
    <DashboardShell title="Teacher Dashboard" navItems={teacherNav} allowedRoles={["teacher"]}>
      <div className="grid gap-6">
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Welcome{user?.full_name ? `, ${user.full_name}` : ""}</CardTitle>
              <CardDescription>
                Today&apos;s attendance overview for your center
                {user?.institution_id ? ` (#${user.institution_id})` : ""}. Launch the face kiosk
                or use QR scanning below.
              </CardDescription>
            </div>
            <Link href="/teacher/attendance/kiosk">
              <Button
                type="button"
                size="lg"
                className="w-full bg-emerald-600 text-white hover:bg-emerald-500 sm:w-auto"
              >
                <Camera className="size-4" />
                Launch Kiosk Scanner 📸
              </Button>
            </Link>
          </CardHeader>
        </Card>

        <TeacherAttendanceDashboard todayOnly compact />

        <Card>
          <CardHeader>
            <CardTitle>Live QR Scanner</CardTitle>
            <CardDescription>
              Optional backup: point the camera at a student QR code to mark attendance for today.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeacherLiveQrScanner
              onMarked={() => {
                // Attendance panel polls while viewing today; bump via navigation refresh is enough.
              }}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/teacher/attendance">
                <Button type="button" variant="outline">
                  Open Full Attendance
                </Button>
              </Link>
              <Link href="/teacher/attendance/reports">
                <Button type="button" variant="secondary">
                  Attendance Reports & Export
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
