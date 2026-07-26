import { redirect } from "next/navigation"

/** Face kiosk marking is teacher-only. */
export default function AdminKioskAttendancePage() {
  redirect("/admin/dashboard")
}
