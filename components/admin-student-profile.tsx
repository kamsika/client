"use client"

import { useCallback, useRef } from "react"
import { toast } from "sonner"

import { StudentQrCode } from "@/components/student-qr-code"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { downloadStudentQrCanvas, printStudentQrCanvas } from "@/lib/download-qr-image"
import { studentInitials } from "@/lib/student-qr-payload"
import type { Student } from "@/types"

interface AdminStudentProfileProps {
  student: Student
}

function displayContact(student: Student) {
  return student.contact || student.email || "—"
}

export function AdminStudentProfile({ student }: AdminStudentProfileProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const studentId = student.registration_no

  const handleDownloadQrCode = useCallback(() => {
    const canvas = qrCanvasRef.current
    if (!canvas) {
      toast.error("QR code is not ready to download")
      return
    }

    try {
      downloadStudentQrCanvas(canvas, studentId)
      toast.success("QR code downloaded")
    } catch {
      toast.error("Failed to download QR code")
    }
  }, [studentId])

  const handlePrintQrCode = useCallback(() => {
    const canvas = qrCanvasRef.current
    if (!canvas) {
      toast.error("QR code is not ready to print")
      return
    }

    try {
      printStudentQrCanvas(canvas, studentId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to print QR code")
    }
  }, [studentId])

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

      <div className="flex flex-col items-center gap-4 rounded-lg border bg-white p-5 text-black">
        <p className="text-sm font-medium">Student QR Code</p>

        <StudentQrCode ref={qrCanvasRef} studentId={studentId} />

        <div className="flex w-full max-w-[280px] flex-col gap-2">
          <Button variant="outline" className="w-full text-black" onClick={handleDownloadQrCode}>
            Download QR Code
          </Button>
          <Button variant="secondary" className="w-full" onClick={handlePrintQrCode}>
            Print QR Code
          </Button>
        </div>

        <p className="max-w-[280px] text-center text-xs text-neutral-600">
          Encodes plain ID <span className="font-mono font-semibold">{studentId}</span> for easy
          camera scanning.
        </p>
      </div>
    </div>
  )
}
