"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ScanFace } from "lucide-react"
import { toast } from "sonner"

import { EnrolledSubjectsPicker } from "@/components/enrolled-subjects-picker"
import { RegisterFaceDialog } from "@/components/face/RegisterFaceDialog"
import { StudentQrCode } from "@/components/student-qr-code"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { getApiErrorMessage } from "@/lib/api-errors"
import { downloadStudentQrCanvas, printStudentQrCanvas } from "@/lib/download-qr-image"
import { buildStudentQrPayload, studentInitials } from "@/lib/student-qr-payload"
import { updateStudent } from "@/services/student"
import type { Student } from "@/types"

interface AdminStudentProfileProps {
  student: Student
  onStudentUpdated?: (student: Student) => void
}

function displayContact(student: Student) {
  return student.contact || student.email || "—"
}

function studentQrLabel(student: Student) {
  const name = student.full_name?.trim() || "Unnamed student"
  return `${name} (${student.registration_no})`
}

function enrolledList(student: Student) {
  return student.enrolledSubjects ?? student.enrolled_subjects ?? []
}

export function AdminStudentProfile({ student, onStudentUpdated }: AdminStudentProfileProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const qrPayload = buildStudentQrPayload(student.registration_no)
  const label = studentQrLabel(student)
  const [enrolledSubjects, setEnrolledSubjects] = useState<string[]>(() => enrolledList(student))
  const [saving, setSaving] = useState(false)
  const [faceDialogOpen, setFaceDialogOpen] = useState(false)
  const [faceRegistered, setFaceRegistered] = useState(Boolean(student.has_face_descriptor))

  useEffect(() => {
    setEnrolledSubjects(enrolledList(student))
  }, [student])

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

  async function handleSaveSubjects() {
    setSaving(true)
    try {
      const result = await updateStudent(student.id, { enrolledSubjects })
      onStudentUpdated?.(result.student)
      toast.success("Enrolled subjects updated")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update enrolled subjects"))
    } finally {
      setSaving(false)
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
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-muted-foreground">Enrolled</dt>
            <dd className="flex flex-wrap gap-1.5">
              {enrolledList(student).length > 0 ? (
                enrolledList(student).map((subject) => (
                  <Badge key={subject} variant="secondary">
                    {subject}
                  </Badge>
                ))
              ) : (
                <span>—</span>
              )}
            </dd>
          </div>
        </dl>

        <EnrolledSubjectsPicker value={enrolledSubjects} onChange={setEnrolledSubjects} />
        <Button type="button" onClick={() => void handleSaveSubjects()} disabled={saving}>
          {saving ? "Saving…" : "Save Enrolled Subjects"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="border-[#A2D4ED] text-[#0047AB]"
          onClick={() => setFaceDialogOpen(true)}
        >
          <ScanFace className="size-4" />
          Register Face
          {faceRegistered ? " (update)" : ""}
        </Button>

        <RegisterFaceDialog
          student={student}
          open={faceDialogOpen}
          onOpenChange={setFaceDialogOpen}
          onRegistered={() => {
            setFaceRegistered(true)
            onStudentUpdated?.({ ...student, has_face_descriptor: true })
          }}
        />
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
