"use client"

import { DashboardShell } from "@/components/dashboard-shell"
import { TeacherFeatureNavbar } from "@/components/teacher-feature-navbar"
import { getTeacherShellNav } from "@/lib/teacher-nav"

/** Shared teacher chrome: sticky header + feature tabs + Reports/Roster links. */
export function TeacherShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <DashboardShell
      title={title}
      navItems={getTeacherShellNav()}
      allowedRoles={["teacher"]}
      featureNav={<TeacherFeatureNavbar />}
    >
      {children}
    </DashboardShell>
  )
}
