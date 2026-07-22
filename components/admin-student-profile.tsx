"use client"

import { useRef } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { Download, Printer } from "lucide-react"
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

  function handlePrint() {
    const canvas = canvasRef.current
    if (!canvas) {
      toast.error("QR code is not ready to print")
      return
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer")
    if (!printWindow) {
      toast.error("Allow pop-ups to print the QR code")
      return
    }

    const name = student.full_name || "Student"
    const qrImage = canvas.toDataURL("image/png")

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${name} — ${student.registration_no}</title>
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 2rem; }
            h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
            p { color: #555; margin: 0.25rem 0; }
            img { margin-top: 1.5rem; width: 220px; height: 220px; }
          </style>
        </head>
        <body>
          <h1>${name}</h1>
          <p>Student ID: ${student.registration_no}</p>
          ${student.email ? `<p>${student.email}</p>` : ""}
          <img src="${qrImage}" alt="QR code for ${student.registration_no}" />
          <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>
        </body>
      </html>
    `)
    printWindow.document.close()
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
            <dt className="text-muted-foreground">Email</dt>
            <dd>{student.email || "—"}</dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-muted-foreground">Parent</dt>
            <dd>{student.parent_name || "—"}</dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-muted-foreground">Parent phone</dt>
            <dd>{student.parent_phone || "—"}</dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-muted-foreground">Internal ID</dt>
            <dd>{student.id}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-lg border bg-white p-4">
        <p className="text-sm font-medium">Attendance QR Code</p>
        <StudentQrCode registrationNo={student.registration_no} size={180} />
        <p className="text-muted-foreground max-w-[220px] text-center text-xs">
          Encodes student ID <span className="font-mono">{student.registration_no}</span>
        </p>

        <QRCodeCanvas
          ref={canvasRef}
          value={buildStudentQrPayload(student.registration_no)}
          size={360}
          level="M"
          className="hidden"
          aria-hidden
        />

        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={handleDownload}>
            <Download className="size-4" />
            Download QR
          </Button>
          <Button variant="outline" className="flex-1" onClick={handlePrint}>
            <Printer className="size-4" />
            Print QR
          </Button>
        </div>
      </div>
    </div>
  )
}
