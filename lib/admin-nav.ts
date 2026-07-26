import {
  ClipboardCheck,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  MessageSquare,
  ScanFace,
  School,
  Upload,
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
      {
        href: "/admin/billing",
        label: "Billing",
        description: "Plans & invoices",
        icon: CreditCard,
      },
    ]
  }

  return [
    {
      href: "/admin/dashboard",
      label: "Dashboard",
      description: "Overview & management",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: "/admin/billing",
      label: "Billing",
      description: "Plans & invoices",
      icon: CreditCard,
    },
    {
      href: "/admin/attendance",
      label: "Attendance",
      description: "Mark & review",
      icon: ClipboardCheck,
    },
    {
      href: "/admin/attendance/kiosk",
      label: "Face Kiosk",
      description: "Face recognition",
      icon: ScanFace,
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
      href: "/admin/sms-logs",
      label: "SMS Logs",
      description: "Parent alerts",
      icon: MessageSquare,
    },
    {
      href: "/admin/students/import",
      label: "Import Students",
      description: "Bulk upload",
      icon: Upload,
    },
    {
      href: "/admin/students/face",
      label: "Face Registration",
      description: "Student faces",
      icon: ScanFace,
    },
  ]
}
