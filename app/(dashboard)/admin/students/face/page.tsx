"use client"

import { DashboardShell } from "@/components/dashboard-shell"
import { StudentFaceRegistration } from "@/components/student-face-registration"
import { getAdminNav } from "@/lib/admin-nav"

export default function AdminFaceRegistrationPage() {
  return (
    <DashboardShell
      title="Face Registration"
      navItems={getAdminNav(false)}
      allowedRoles={["institution_admin"]}
    >
      <StudentFaceRegistration />
    </DashboardShell>
  )
}
