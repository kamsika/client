"use client"

import Link from "next/link"
import { QrCode, ScanFace } from "lucide-react"

import { cn } from "@/lib/utils"
import { withTenantPrefix, getClientTenant } from "@/lib/tenant"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white p-6 shadow-[0_12px_40px_rgba(5,8,46,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(162,212,237,0.25)]"

export default function TeacherAttendanceMethodsPage() {
  const tenant = getClientTenant()
  const qrHref = withTenantPrefix("/teacher/dashboard/qr-scanner", tenant)
  const faceHref = withTenantPrefix("/teacher/dashboard/face-scanner", tenant)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[#05082E]">Attendance Methods</h2>
        <p className="text-sm text-[#0047AB]/75">
          Choose how to mark attendance today. QR and Face Recognition both write to the same
          attendance records.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href={qrHref} className={cn(cardShell, "group block")}>
          <span className="inline-flex size-12 items-center justify-center rounded-xl bg-[#ABD2F2]/50 text-[#0047AB]">
            <QrCode className="size-6" />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-[#05082E]">QR Attendance</h3>
          <p className="mt-2 text-sm text-[#0047AB]/75">
            Scan student QR codes, review subjects, and mark Present — unchanged from before.
          </p>
        </Link>

        <Link href={faceHref} className={cn(cardShell, "group block")}>
          <span className="inline-flex size-12 items-center justify-center rounded-xl bg-[#A2D4ED]/50 text-[#0047AB]">
            <ScanFace className="size-6" />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-[#05082E]">Face Attendance</h3>
          <p className="mt-2 text-sm text-[#0047AB]/75">
            Real-time face recognition with automatic Present marking and duplicate protection.
          </p>
        </Link>
      </div>
    </div>
  )
}
