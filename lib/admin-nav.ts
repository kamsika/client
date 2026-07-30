import {
  Building2,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  School,
  Upload,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react"

export type AdminNavItem = {
  href: string
  label: string
  description?: string
  exact?: boolean
  icon?: LucideIcon
}

export function getAdminNav(isSuperAdmin: boolean): AdminNavItem[] {
  if (isSuperAdmin) {
    return [
      {
        href: "/admin/dashboard",
        label: "Dashboard",
        description: "Overview & tenants",
        icon: LayoutDashboard,
        exact: true,
      },
    ]
  }

  return [
    {
      href: "/dashboard",
      label: "Dashboard",
      description: "Overview & management",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: "/admin/fees",
      label: "Fee Management",
      description: "Student monthly fees",
      icon: Wallet,
    },
    {
      href: "/admin/attendance",
      label: "Attendance",
      description: "Mark & review",
      icon: ClipboardCheck,
    },
    {
      href: "/admin/attendance/reports",
      label: "Reports",
      description: "Attendance analytics",
      icon: FileBarChart,
    },
    {
      href: "/admin/timetable",
      label: "Timetable",
      description: "Class schedule",
      icon: School,
    },
    {
      href: "/admin/students/import",
      label: "Import Students",
      description: "Bulk upload",
      icon: Upload,
    },
    {
      href: "/admin/institution",
      label: "Institution",
      description: "Profile & branding",
      icon: Building2,
    },
    {
      href: "/admin/settings",
      label: "Settings",
      description: "Security & account",
      icon: Settings,
    },
  ]
}
