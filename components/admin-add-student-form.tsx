"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { StudentQrCode } from "@/components/student-qr-code"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { createStudent } from "@/services/student"
import type { Student } from "@/types"

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
}

export function AdminAddStudentForm({ existingStudents, onStudentAdded }: AdminAddStudentFormProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [savedStudent, setSavedStudent] = useState<Student | null>(null)
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null)

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
      <Card>
        <CardHeader>
          <CardTitle>Student Added Successfully</CardTitle>
          <CardDescription>
            {savedStudent.full_name} · ID: {studentId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-300">
            Student saved with ID <span className="font-mono font-semibold">{studentId}</span>. QR code
            is ready below.
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Name:</span> {savedStudent.full_name}
            </div>
            <div>
              <span className="text-muted-foreground">Grade:</span> {savedStudent.grade}
            </div>
            <div>
              <span className="text-muted-foreground">Section:</span> {savedStudent.section}
            </div>
            <div>
              <span className="text-muted-foreground">Gender:</span> {savedStudent.gender}
            </div>
            <div>
              <span className="text-muted-foreground">Contact:</span>{" "}
              {savedStudent.contact || form.contact}
            </div>
          </dl>

          <div className="flex flex-col items-center gap-3 rounded-lg border bg-white p-5 text-black">
            <p className="text-sm font-medium">Generated QR Code</p>
            <StudentQrCode
              key={`created-qr-${savedStudent.id}-${studentId}`}
              ref={qrCanvasRef}
              studentDbId={savedStudent.id}
              studentId={studentId}
              label={`${savedStudent.full_name || "Student"} (${studentId})`}
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

          <Button variant="secondary" onClick={handleAddAnother}>
            Add Another Student
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Student</CardTitle>
        <CardDescription>
          Register a new student. The next ID will be assigned automatically (preview:{" "}
          <span className="font-mono">{previewStudentId}</span>).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {duplicateMessage && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {duplicateMessage}
          </div>
        )}

        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="student-name">Name</Label>
            <Input
              id="student-name"
              className="text-black"
              placeholder="Enter full name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-grade">Grade</Label>
            <Input
              id="student-grade"
              className="text-black"
              placeholder="e.g. 10"
              value={form.grade}
              onChange={(event) => setForm({ ...form, grade: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-section">Section</Label>
            <Input
              id="student-section"
              className="text-black"
              placeholder="e.g. A"
              value={form.section}
              onChange={(event) => setForm({ ...form, section: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-gender">Gender</Label>
            <Select
              value={form.gender || undefined}
              onValueChange={(value) => value && setForm({ ...form, gender: value as GenderOption })}
            >
              <SelectTrigger id="student-gender" className="text-black">
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
            <Label htmlFor="student-contact">Contact Number</Label>
            <Input
              id="student-contact"
              className="text-black"
              placeholder="e.g. +94771234567"
              value={form.contact}
              onChange={(event) => setForm({ ...form, contact: event.target.value })}
            />
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {submitting ? "Saving..." : "Add Student"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
