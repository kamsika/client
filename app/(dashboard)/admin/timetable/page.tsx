"use client"

import { InstitutionAdminShell } from "@/components/institution-admin-shell"
import { TimetableManager } from "@/components/timetable-manager"
import { getAdminNav } from "@/lib/admin-nav"

export default function AdminTimetablePage() {
  return (
    <InstitutionAdminShell
      title="Timetable"
      navItems={getAdminNav(false)}
      allowedRoles={["institution_admin"]}
    >
      <TimetableManager />
    </InstitutionAdminShell>
  )
}
