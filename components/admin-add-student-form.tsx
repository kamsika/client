"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { EnrolledSubjectsPicker } from "@/components/enrolled-subjects-picker"
import { StudentQrCode } from "@/components/student-qr-code"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { downloadStudentQrCanvas, printStudentQrCanvas } from "@/lib/download-qr-image"
import { findDuplicateStudent, getNextStudentId } from "@/lib/generate-student-id"
import { getApiErrorMessage } from "@/lib/api-errors"
import { cn } from "@/lib/utils"
import { createStudent } from "@/services/student"
import { previewRegistrationFees } from "@/services/tuition"
import type { Student } from "@/types"

const fieldClass =
  "h-11 border-[#A2D4ED] bg-white text-[#05082E] transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const primaryBtn =
  "gap-2 bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white"

const outlineBtn =
  "border-[#A2D4ED] text-[#0047AB] transition hover:bg-[#ABD2F2]/40"

const cardShell =
  "overflow-hidden rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

interface AdminAddStudentFormProps {
  existingStudents: Student[]
  onStudentAdded: (student: Student) => void
}

type GenderOption = "Male" | "Female" | "Other"

const emptyForm = {
  name: "",
  grade: "",
  section: "",
  gender: "" as GenderOption | "",
  contact: "",
  enrolledSubjects: [] as string[],
  joiningDate: new Date().toISOString().slice(0, 10),
  discount: "",
}

export function AdminAddStudentForm({ existingStudents, onStudentAdded }: AdminAddStudentFormProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [savedStudent, setSavedStudent] = useState<Student | null>(null)
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null)
  const [feePreview, setFeePreview] = useState<Awaited<ReturnType<typeof previewRegistrationFees>> | null>(null)

  useEffect(() => {
    if (form.enrolledSubjects.length === 0) {
      setFeePreview(null)
      return
    }
    const timer = window.setTimeout(() => {
      void previewRegistrationFees({
        subjects: form.enrolledSubjects,
        joiningDate: form.joiningDate,
        discount: Number(form.discount || 0),
      }).then(setFeePreview).catch(() => setFeePreview(null))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [form.enrolledSubjects, form.joiningDate, form.discount])

  const previewStudentId = useMemo(
    () => getNextStudentId(existingStudents),
    [existingStudents],
  )

  const handleDownloadQrCode = useCallback(() => {
    if (!savedStudent) return

    const canvas = qrCanvasRef.current
    if (!canvas) {
      toast.error("QR code is not ready to download")
      return
    }

    try {
      downloadStudentQrCanvas(canvas, savedStudent.registration_no)
      toast.success("QR code downloaded")
    } catch {
      toast.error("Failed to download QR code")
    }
  }, [savedStudent])

  const handlePrintQrCode = useCallback(() => {
    if (!savedStudent) return

    const canvas = qrCanvasRef.current
    if (!canvas) {
      toast.error("QR code is not ready to print")
      return
    }

    try {
      printStudentQrCanvas(canvas, savedStudent.registration_no)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to print QR code")
    }
  }, [savedStudent])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDuplicateMessage(null)

    if (!form.name.trim() || !form.grade.trim() || !form.section.trim() || !form.gender || !form.contact.trim()) {
      toast.error("Please fill in all fields")
      return
    }

    const duplicate = findDuplicateStudent(existingStudents, form.name, form.contact)
    if (duplicate) {
      const message = "Student already exists!"
      setDuplicateMessage(message)
      toast.error(message)
      window.alert(message)
      return
    }

    setSubmitting(true)
    try {
      const result = await createStudent({
        full_name: form.name.trim(),
        grade: form.grade.trim(),
        section: form.section.trim(),
        gender: form.gender,
        contact: form.contact.trim(),
        enrolledSubjects: form.enrolledSubjects,
        joiningDate: form.joiningDate,
        discountAmount: Number(form.discount || 0),
      })

      setSavedStudent(result.student)
      onStudentAdded(result.student)
      toast.success(result.message || `Student ${result.student.registration_no} created successfully!`)
    } catch (error) {
      const message = getApiErrorMessage(error, "Failed to create student")
      if (message.includes("Student already exists")) {
        setDuplicateMessage("Student already exists!")
        window.alert("Student already exists!")
      }
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleAddAnother() {
    setSavedStudent(null)
    setDuplicateMessage(null)
    setForm(emptyForm)
  }

  if (savedStudent) {
    const studentId = savedStudent.registration_no

    return (
      <div className={cardShell}>
        <div className="border-b border-[#A2D4ED]/40 px-5 py-4">
          <h2 className="text-base font-semibold text-[#05082E]">Student Added Successfully</h2>
          <p className="text-sm text-[#0047AB]/75">
            {savedStudent.full_name} · ID: {studentId}
          </p>
        </div>
        <div className="space-y-6 p-5">
          <div className="rounded-xl border border-[#A2D4ED]/50 bg-[#ABD2F2]/25 p-4 text-sm text-[#0047AB]">
            Student saved with ID <span className="font-mono font-semibold text-[#05082E]">{studentId}</span>.
            QR code is ready below.
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="text-[#0047AB]/70">Name:</span>{" "}
              <span className="text-[#05082E]">{savedStudent.full_name}</span>
            </div>
            <div>
              <span className="text-[#0047AB]/70">Grade:</span>{" "}
              <span className="text-[#05082E]">{savedStudent.grade}</span>
            </div>
            <div>
              <span className="text-[#0047AB]/70">Section:</span>{" "}
              <span className="text-[#05082E]">{savedStudent.section}</span>
            </div>
            <div>
              <span className="text-[#0047AB]/70">Gender:</span>{" "}
              <span className="text-[#05082E]">{savedStudent.gender}</span>
            </div>
            <div>
              <span className="text-[#0047AB]/70">Contact:</span>{" "}
              <span className="text-[#05082E]">{savedStudent.contact || form.contact}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-[#0047AB]/70">Enrolled subjects:</span>{" "}
              <span className="text-[#05082E]">
                {(savedStudent.enrolledSubjects ?? savedStudent.enrolled_subjects ?? []).length > 0
                  ? (savedStudent.enrolledSubjects ?? savedStudent.enrolled_subjects ?? []).join(", ")
                  : "None"}
              </span>
            </div>
          </dl>

          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#A2D4ED]/50 bg-[#f8fbfe] p-5">
            <p className="text-sm font-medium text-[#05082E]">Generated QR Code</p>
            <StudentQrCode
              key={`created-qr-${savedStudent.id}-${studentId}`}
              ref={qrCanvasRef}
              studentDbId={savedStudent.id}
              studentId={studentId}
              label={`${savedStudent.full_name || "Student"} (${studentId})`}
            />
            <div className="flex w-full max-w-[280px] flex-col gap-2">
              <Button variant="outline" className={cn("w-full", outlineBtn)} onClick={handleDownloadQrCode}>
                Download QR Code
              </Button>
              <Button className={cn("w-full", primaryBtn)} onClick={handlePrintQrCode}>
                Print QR Code
              </Button>
            </div>
          </div>

          <Button variant="outline" className={outlineBtn} onClick={handleAddAnother}>
            Add Another Student
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cardShell}>
      <div className="border-b border-[#A2D4ED]/40 px-5 py-4">
        <h2 className="text-base font-semibold text-[#05082E]">Add Student</h2>
        <p className="text-sm text-[#0047AB]/75">
          Register a new student. The next ID will be assigned automatically (preview:{" "}
          <span className="font-mono font-medium text-[#05082E]">{previewStudentId}</span>).
        </p>
      </div>
      <div className="p-5">
        {duplicateMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {duplicateMessage}
          </div>
        )}

        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="student-name" className="text-[#05082E]">
              Name
            </Label>
            <Input
              id="student-name"
              className={fieldClass}
              placeholder="Enter full name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-grade" className="text-[#05082E]">
              Grade
            </Label>
            <Input
              id="student-grade"
              className={fieldClass}
              placeholder="e.g. 10"
              value={form.grade}
              onChange={(event) => setForm({ ...form, grade: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-section" className="text-[#05082E]">
              Section
            </Label>
            <Input
              id="student-section"
              className={fieldClass}
              placeholder="e.g. A"
              value={form.section}
              onChange={(event) => setForm({ ...form, section: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-gender" className="text-[#05082E]">
              Gender
            </Label>
            <Select
              value={form.gender || undefined}
              onValueChange={(value) => value && setForm({ ...form, gender: value as GenderOption })}
            >
              <SelectTrigger id="student-gender" className={cn(fieldClass, "w-full")}>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-contact" className="text-[#05082E]">
              Contact Number
            </Label>
            <Input
              id="student-contact"
              className={fieldClass}
              placeholder="e.g. +94771234567"
              value={form.contact}
              onChange={(event) => setForm({ ...form, contact: event.target.value })}
            />
          </div>

          <div className="sm:col-span-2">
            <EnrolledSubjectsPicker
              value={form.enrolledSubjects}
              onChange={(enrolledSubjects) => setForm({ ...form, enrolledSubjects })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-joining-date">Joining date</Label>
            <Input
              id="student-joining-date"
              type="date"
              className={fieldClass}
              value={form.joiningDate}
              onChange={(event) => setForm({ ...form, joiningDate: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="student-discount">Monthly discount (LKR)</Label>
            <Input
              id="student-discount"
              type="number"
              min="0"
              step="0.01"
              className={fieldClass}
              value={form.discount}
              onChange={(event) => setForm({ ...form, discount: event.target.value })}
            />
          </div>

          {form.enrolledSubjects.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-[#A2D4ED]/50 bg-[#f8fbfe] p-4 sm:col-span-2">
              <p className="font-medium text-[#05082E]">Subject fee preview</p>
              {feePreview?.lines.map((line) => (
                <div key={line.subject_id} className="flex justify-between text-sm">
                  <span>{line.subject_name}</span>
                  <span className={line.configured ? "font-medium" : "text-amber-700"}>
                    {line.configured ? `Rs. ${Number(line.monthly_fee).toLocaleString()}` : "Fee not configured for this subject."}
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 text-sm">
                <div className="flex justify-between"><span>Monthly fee</span><span>Rs. {Number(feePreview?.monthly_fee || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>Rs. {Number(feePreview?.discount || 0).toLocaleString()}</span></div>
                <div className="flex justify-between font-semibold"><span>Net monthly fee</span><span>Rs. {Number(feePreview?.net_monthly_fee || 0).toLocaleString()}</span></div>
              </div>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <Button type="submit" className={cn("h-11 w-full sm:w-auto", primaryBtn)} disabled={submitting}>
              {submitting ? "Saving..." : "Add Student"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
