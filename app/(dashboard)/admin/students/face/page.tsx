"use client"

import { InstitutionAdminShell } from "@/components/institution-admin-shell"
import { StudentFaceRegistration } from "@/components/student-face-registration"
import { getAdminNav } from "@/lib/admin-nav"

export default function AdminFaceRegistrationPage() {
  return (
    <InstitutionAdminShell
      title="Face Registration"
      navItems={getAdminNav(false)}
      allowedRoles={["institution_admin"]}
    >
      <StudentFaceRegistration />
    </InstitutionAdminShell>
  )
}
