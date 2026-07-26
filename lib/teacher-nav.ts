import type { LucideIcon } from "lucide-react"
import {
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  QrCode,
  ScanFace,
} from "lucide-react"

export type TeacherNavItem = {
  href: string
  label: string
  /** When true, only the exact path is treated as active (not nested routes). */
  exact?: boolean
  icon?: LucideIcon
}

/** Sticky feature tabs for the teacher workspace. */
export function getTeacherFeatureNav(): TeacherNavItem[] {
  return [
    {
      href: "/teacher/dashboard",
      label: "Overview",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: "/teacher/dashboard/qr-scanner",
      label: "QR Scanner",
      icon: QrCode,
    },
    {
      href: "/teacher/dashboard/kiosk",
      label: "Face Attendance",
      icon: ScanFace,
    },
    {
      href: "/teacher/dashboard/manual",
      label: "Manual Attendance",
      icon: ClipboardCheck,
    },
    {
      href: "/teacher/dashboard/timetable",
      label: "Timetable",
      icon: CalendarDays,
    },
  ]
}

/** Secondary shell links (shown alongside feature tabs). */
export function getTeacherShellNav(): TeacherNavItem[] {
  return [
    { href: "/teacher/attendance", label: "Full Roster", exact: true },
    { href: "/teacher/attendance/reports", label: "Reports" },
  ]
}

/** Combined nav used by DashboardShell on teacher pages. */
export function getTeacherNav(): TeacherNavItem[] {
  return [...getTeacherFeatureNav(), ...getTeacherShellNav()]
}
