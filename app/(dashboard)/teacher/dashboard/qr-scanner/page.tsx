"use client"

import { TeacherLiveQrScanner } from "@/components/teacher-live-qr-scanner"
import { cn } from "@/lib/utils"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

export default function TeacherQrScannerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[#05082E]">QR Scanner</h2>
        <p className="text-sm text-[#0047AB]/75">
          Scan any student QR code. Review their grade and enrolled subjects, select today&apos;s
          class, then mark attendance as Present.
        </p>
      </div>

      <div className={cn(cardShell, "overflow-hidden p-5")}>
        <TeacherLiveQrScanner />
      </div>
    </div>
  )
}
