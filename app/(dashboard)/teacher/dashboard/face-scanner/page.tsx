"use client"

import { TeacherFaceScanner } from "@/components/teacher-face-scanner"

export default function TeacherFaceScannerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[#05082E]">Face Scanner</h2>
        <p className="text-sm text-[#0047AB]/75">
          Real-time face recognition attendance. One student at a time — matches are saved as Present
          with method Face Recognition.
        </p>
      </div>
      <TeacherFaceScanner />
    </div>
  )
}
