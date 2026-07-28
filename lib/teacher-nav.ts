import type { LucideIcon } from "lucide-react"
import {
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  QrCode,
  ScanFace,
  UserRound,
  Users,
  Wallet,
} from "lucide-react"

export type TeacherNavItem = {
  href: string
  label: string
  description?: string
  /** When true, only the exact path is treated as active (not nested routes). */
  exact?: boolean
  icon?: LucideIcon
}

/** Primary left-sidebar navigation for the Teacher Dashboard. */
export function getTeacherNav(): TeacherNavItem[] {
  return [
    {
      href: "/teacher/dashboard",
      label: "Dashboard",
      description: "Today's overview",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: "/teacher/dashboard/attendance-methods",
      label: "Attendance",
      description: "QR or Face methods",
      icon: ClipboardCheck,
    },
    {
      href: "/teacher/dashboard/qr-scanner",
      label: "QR Scanner",
      description: "Mark by QR code",
      icon: QrCode,
    },
    {
      href: "/teacher/dashboard/face-scanner",
      label: "Face Scanner",
      description: "Mark by face recognition",
      icon: ScanFace,
    },
    {
      href: "/teacher/dashboard/manual",
      label: "Manual Attendance",
      description: "Mark roster by hand",
      icon: ClipboardCheck,
    },
    {
      href: "/teacher/dashboard/attendance",
      label: "Attendance History",
      description: "Roster & status",
      icon: ClipboardList,
    },
    {
      href: "/teacher/dashboard/students",
      label: "Students",
      description: "Subjects & profiles",
      icon: Users,
    },
    {
      href: "/teacher/dashboard/fees",
      label: "Fee Management",
      description: "Collect & update fees",
      icon: Wallet,
    },
    {
      href: "/teacher/dashboard/profile",
      label: "Profile",
      description: "Your account",
      icon: UserRound,
    },
  ]
}

/** @deprecated Use getTeacherNav() — kept for older imports. */
export function getTeacherFeatureNav(): TeacherNavItem[] {
  return getTeacherNav()
}

/** @deprecated Use getTeacherNav() — kept for older imports. */
export function getTeacherShellNav(): TeacherNavItem[] {
  return getTeacherNav()
}
