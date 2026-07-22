"use client"

import { useRef } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { StudentQrCode } from "@/components/student-qr-code"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  buildStudentQrPayload,
  studentInitials,
  studentQrDownloadFilename,
} from "@/lib/student-qr-payload"
import type { Student } from "@/types"

interface AdminStudentProfileProps {
  student: Student
}

function displayContact(student: Student) {
  return student.contact || student.email || "—"
}

export function AdminStudentProfile({ student }: AdminStudentProfileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) {
      toast.error("QR code is not ready to download")
      return
    }

    try {
      const link = document.createElement("a")
      link.href = canvas.toDataURL("image/png")
      link.download = studentQrDownloadFilename(student.registration_no)
      link.click()
      toast.success("QR code downloaded")
    } catch {
      toast.error("Failed to download QR code")
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <Avatar size="lg">
            <AvatarFallback>{studentInitials(student.full_name)}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-lg font-semibold">{student.full_name || "Unnamed student"}</h3>
            <p className="text-muted-foreground text-sm">Student ID: {student.registration_no}</p>
          </div>
        </div>

        <Separator />

        <dl className="grid gap-3 text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{student.full_name || "—"}</dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-muted-foreground">Grade</dt>
            <dd>{student.grade || "—"}</dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-muted-foreground">Section</dt>
            <dd>{student.section || "—"}</dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-muted-foreground">Gender</dt>
            <dd>{student.gender || "—"}</dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-muted-foreground">Contact</dt>
            <dd>{displayContact(student)}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-lg border bg-white p-4">
        <p className="text-sm font-medium">Student QR Code</p>
        <StudentQrCode registrationNo={student.registration_no} size={180} />
        <p className="text-muted-foreground max-w-[220px] text-center text-xs">
          Based on student ID <span className="font-mono">{student.registration_no}</span>
        </p>

        <QRCodeCanvas
          ref={canvasRef}
          value={buildStudentQrPayload(student.registration_no)}
          size={360}
          level="M"
          className="hidden"
          aria-hidden
        />

        <Button variant="outline" className="w-full" onClick={handleDownload}>
          <Download className="size-4" />
          Download QR
        </Button>
      </div>
    </div>
  )
}
