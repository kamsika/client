import { redirect } from "next/navigation"

/** Daily marking is teacher-only; admins use Attendance Reports. */
export default function AdminAttendancePage() {
  redirect("/admin/dashboard")
}
