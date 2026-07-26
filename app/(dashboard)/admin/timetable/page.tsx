import { redirect } from "next/navigation"

/** Timetable management is teacher-only. */
export default function AdminTimetablePage() {
  redirect("/admin/dashboard")
}
