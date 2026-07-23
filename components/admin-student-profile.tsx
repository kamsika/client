"use client"

import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"

import { StudentQrCode } from "@/components/student-qr-code"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { downloadStudentQrCanvas, printStudentQrCanvas } from "@/lib/download-qr-image"
import { buildStudentQrPayload, studentInitials } from "@/lib/student-qr-payload"
import type { Student } from "@/types"

interface AdminStudentProfileProps {
  student: Student
}

function displayContact(student: Student) {
  return student.contact || student.email || "—"
}

function studentQrLabel(student: Student) {
  const name = student.full_name?.trim() || "Unnamed student"
  return `${name} (${student.registration_no})`
}

export function AdminStudentProfile({ student }: AdminStudentProfileProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  // Prefer registration_no as the scannable student ID (unique per center).
  const qrPayload = buildStudentQrPayload(student.registration_no)
  const label = studentQrLabel(student)

  useEffect(() => {
    console.log("[QR] Profile QR for", {
      dbId: student.id,
      name: student.full_name,
      registrationNo: student.registration_no,
      payload: qrPayload,
    })
  }, [student.id, student.full_name, student.registration_no, qrPayload])

  const handleDownloadQrCode = useCallback(() => {
    const canvas = qrCanvasRef.current
    if (!canvas) {
      toast.error("QR code is not ready to download")
      return
    }

    try {
      downloadStudentQrCanvas(canvas, qrPayload)
      toast.success(`Downloaded QR for ${label}`)
    } catch {
      toast.error("Failed to download QR code")
    }
  }, [label, qrPayload])

  const handlePrintQrCode = useCallback(() => {
    const canvas = qrCanvasRef.current
    if (!canvas) {
      toast.error("QR code is not ready to print")
      return
    }

    try {
      printStudentQrCanvas(canvas, qrPayload)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to print QR code")
    }
  }, [qrPayload])

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
            <p className="text-muted-foreground text-xs">Record #{student.id}</p>
          </div>
        </div>

        <Separator />

        <dl className="grid gap-3 text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{student.full_name || "—"}</dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-muted-foreground">Student ID</dt>
            <dd className="font-mono">{student.registration_no}</dd>
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

        <StudentQrCode
          key={`profile-qr-${student.id}-${qrPayload}`}
          ref={qrCanvasRef}
          studentDbId={student.id}
          studentId={qrPayload}
          label={label}
        />

        <div className="flex w-full max-w-[280px] flex-col gap-2">
          <Button variant="outline" className="w-full text-black" onClick={handleDownloadQrCode}>
            Download QR Code
          </Button>
          <Button variant="secondary" className="w-full" onClick={handlePrintQrCode}>
            Print QR Code
          </Button>
        </div>
      </div>
    </div>
  )
}
