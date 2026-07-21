"use client"

import { Html5Qrcode } from "html5-qrcode"
import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, QrCode } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { parseStudentQr } from "@/lib/parse-student-qr"
import { getClassroomAttendance, markAttendance } from "@/services/attendance"
import type { AttendanceRecord } from "@/types"

interface QrAttendanceDialogProps {
  classroomId: number
  classroomName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getCameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera permission was denied. Click the lock or site icon in your browser address bar, set Camera to Allow, then try again."
    }
    if (error.name === "NotFoundError") {
      return "No camera was found on this device."
    }
    if (error.name === "NotReadableError") {
      return "The camera is in use by another app. Close other apps using the webcam and try again."
    }
    if (error.name === "OverconstrainedError") {
      return "Could not use the selected camera. Try again or use a different device."
    }
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error ?? "")

  if (/secure context|https|localhost/i.test(message)) {
    return "Camera requires HTTPS or localhost. Open the app via https:// or http://localhost."
  }
  if (/permission|not allowed|denied/i.test(message)) {
    return "Camera permission was denied. Allow camera access in your browser site settings and try again."
  }
  if (/not found|no camera|no device|overconstrained/i.test(message)) {
    return "No usable camera found on this device."
  }

  return message || "Unable to access the camera."
}

async function getCameraPermissionState(): Promise<PermissionState | "unknown"> {
  if (!navigator.permissions?.query) {
    return "unknown"
  }

  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName })
    return status.state
  } catch {
    return "unknown"
  }
}

async function startQrScanner(
  elementId: string,
  onScan: (value: string) => void,
): Promise<Html5Qrcode> {
  const scanConfig = {
    fps: 10,
    qrbox: { width: 240, height: 240 },
  }
  const onFailure = () => {}

  const cameraAttempts: Array<string | MediaTrackConstraints> = [{}, { facingMode: "user" }]

  const cameras = await Html5Qrcode.getCameras().catch(() => [] as { id: string; label: string }[])
  for (const camera of cameras) {
    cameraAttempts.push(camera.id)
  }
  cameraAttempts.push({ facingMode: "user" })

  let lastError: unknown = null

  for (const cameraIdOrConfig of cameraAttempts) {
    const scanner = new Html5Qrcode(elementId, { verbose: false })
    try {
      await scanner.start(cameraIdOrConfig, scanConfig, onScan, onFailure)
      return scanner
    } catch (error) {
      lastError = error
      try {
        if (scanner.isScanning) {
          await scanner.stop()
        }
        scanner.clear()
      } catch {
        // ignore cleanup errors between attempts
      }
    }
  }

  throw lastError ?? new Error("Unable to start camera")
}

export function QrAttendanceDialog({
  classroomId,
  classroomName,
  open,
  onOpenChange,
}: QrAttendanceDialogProps) {
  const readerId = `qr-reader-${classroomId}`
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const recordsRef = useRef<AttendanceRecord[]>([])
  const markingRef = useRef(false)

  const [loadingStudents, setLoadingStudents] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const recentScansRef = useRef<Map<number, number>>(new Map())

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true)
    try {
      const data = await getClassroomAttendance(classroomId)
      recordsRef.current = data.records
    } catch {
      toast.error("Failed to load students for this classroom")
    } finally {
      setLoadingStudents(false)
    }
  }, [classroomId])

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return

    try {
      if (scanner.isScanning) {
        await scanner.stop()
      }
    } catch {
      // Scanner may already be stopped when the dialog closes.
    } finally {
      try {
        scanner.clear()
      } catch {
        // clear() throws if the element was already removed.
      }
    }
  }, [])

  const processScan = useCallback(
    async (rawValue: string) => {
      if (markingRef.current) return

      const parsed = parseStudentQr(rawValue.trim())
      if (!parsed) return

      let studentId: number | null = null
      const currentRecords = recordsRef.current

      if (parsed.studentId) {
        studentId =
          currentRecords.find((record) => record.student.id === parsed.studentId)?.student.id ?? null
      } else if (parsed.registrationNo) {
        const normalized = parsed.registrationNo.toLowerCase()
        studentId =
          currentRecords.find(
            (record) => record.student.registration_no.toLowerCase() === normalized,
          )?.student.id ?? null
      }

      if (!studentId) {
        toast.error("QR code does not match a student in this classroom")
        return
      }

      const now = Date.now()
      const lastMarkedAt = recentScansRef.current.get(studentId)
      if (lastMarkedAt && now - lastMarkedAt < 3000) {
        return
      }

      const student = currentRecords.find((record) => record.student.id === studentId)?.student
      const label = student?.full_name || student?.registration_no || "Student"

      markingRef.current = true
      try {
        const result = await markAttendance(studentId, classroomId)
        recentScansRef.current.set(studentId, now)
        setLastScan(label)
        toast.success(
          result.attendance.status === "Late"
            ? `${label} marked late (${result.delta_minutes} min) — parent SMS triggered`
            : result.attendance.status === "Absent"
              ? `${label} marked absent — parent SMS triggered`
              : `${label} marked ${result.attendance.status}`,
        )
        await loadStudents()
      } catch {
        toast.error(`Failed to mark attendance for ${label}`)
      } finally {
        markingRef.current = false
      }
    },
    [classroomId, loadStudents],
  )

  useEffect(() => {
    if (!open) {
      setLastScan(null)
      setCameraActive(false)
      setCameraStarting(false)
      setCameraError(null)
      recentScansRef.current.clear()
      void stopScanner()
      return
    }

    loadStudents()
  }, [open, loadStudents, stopScanner])

  async function handleEnableCamera() {
    setCameraError(null)

    if (typeof window !== "undefined" && !window.isSecureContext) {
      const message = getCameraErrorMessage(new Error("secure context"))
      setCameraError(message)
      toast.error(message)
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "This browser does not support camera access."
      setCameraError(message)
      toast.error(message)
      return
    }

    const permissionState = await getCameraPermissionState()
    if (permissionState === "denied") {
      const message =
        "Camera is blocked for this site. Open browser site settings, allow Camera access, then click Allow Camera Access again."
      setCameraError(message)
      toast.error(message)
      return
    }

    setCameraStarting(true)

    try {
      await stopScanner()

      const scanner = await startQrScanner(readerId, (value) => {
        void processScan(value)
      })

      scannerRef.current = scanner
      setCameraActive(true)
    } catch (error) {
      setCameraActive(false)
      const message = getCameraErrorMessage(error)
      setCameraError(message)
      toast.error(message)
    } finally {
      setCameraStarting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-4" />
            Scan QR Code for Attendance
          </DialogTitle>
          <DialogDescription>
            Point the camera at a student QR code for {classroomName}. Click Allow Camera Access
            and approve the browser permission prompt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative min-h-[280px] overflow-hidden rounded-lg border bg-black">
            <div
              id={readerId}
              className="min-h-[280px] w-full [&_video]:max-h-[320px] [&_video]:w-full [&_video]:object-cover"
            />

            {!cameraActive && (
              <div className="absolute inset-0 flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/80">
                <p>
                  {loadingStudents
                    ? "Loading students..."
                    : "Your browser will ask to use the camera. Click Allow when prompted."}
                </p>
                <Button
                  type="button"
                  onClick={() => void handleEnableCamera()}
                  disabled={loadingStudents || cameraStarting}
                >
                  <Camera className="size-4" />
                  {cameraStarting ? "Starting camera..." : "Allow Camera Access"}
                </Button>
              </div>
            )}

            {cameraActive && cameraStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-white/80">
                Starting camera...
              </div>
            )}
          </div>

          {cameraError && (
            <div className="space-y-2 text-center">
              <p className="text-destructive text-sm">{cameraError}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void handleEnableCamera()}>
                Try Again
              </Button>
            </div>
          )}

          {lastScan && (
            <p className="text-muted-foreground text-center text-sm">
              Last scanned: <span className="text-foreground font-medium">{lastScan}</span>
            </p>
          )}

          <p className="text-muted-foreground text-xs">
            QR codes can contain a student registration number (e.g. STU-2026-001) or student ID.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
