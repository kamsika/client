import { redirect } from "next/navigation"

/** Legacy/admin alias — face kiosk is teacher-only. */
export default function AdminKioskAliasPage() {
  redirect("/admin/dashboard")
}
