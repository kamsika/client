"use client"

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, QrCode, SwitchCamera } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getClassroomAttendance, markAttendanceByScan } from "@/services/attendance"
import { getApiErrorMessage, isAlreadyScannedError } from "@/lib/api-errors"
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

type FacingMode = "environment" | "user"

async function startQrScanner(
  elementId: string,
  cameraConfig: string | MediaTrackConstraints,
  onScan: (value: string) => void,
): Promise<Html5Qrcode> {
  const scanConfig = {
    fps: 10,
    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
      const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
      const size = Math.max(180, Math.min(250, Math.floor(minEdge * 0.75)))
      return { width: size, height: size }
    },
    aspectRatio: 1.777778,
    disableFlip: false,
  }
  const onFailure = () => {}

  const cameraAttempts: Array<string | MediaTrackConstraints> = []

  if (typeof cameraConfig === "object" && cameraConfig.facingMode === "environment") {
    cameraAttempts.push(
      { facingMode: { exact: "environment" } },
      { facingMode: "environment" },
    )
  } else if (typeof cameraConfig === "object" && cameraConfig.facingMode === "user") {
    cameraAttempts.push({ facingMode: "user" })
  } else {
    cameraAttempts.push(cameraConfig)
  }

  const cameras = await Html5Qrcode.getCameras().catch(() => [] as { id: string; label: string }[])
  for (const camera of cameras) {
    if (!cameraAttempts.includes(camera.id)) {
      cameraAttempts.push(camera.id)
    }
  }

  let lastError: unknown = null

  for (const cameraIdOrConfig of cameraAttempts) {
    const scanner = new Html5Qrcode(elementId, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      useBarCodeDetectorIfSupported: true,
    })
    try {
      await scanner.start(
        cameraIdOrConfig,
        scanConfig,
        (decodedText) => {
          console.log("🎯 Raw Scanned Text:", decodedText)
          onScan(decodedText)
        },
        onFailure,
      )
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
  const [studentsReady, setStudentsReady] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [activeFacingMode, setActiveFacingMode] = useState<FacingMode>("environment")
  const recentScansRef = useRef<Map<string, number>>(new Map())

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

      // Exact scanned QR text — never substitute another student's ID.
      const scannedId = rawValue.trim()
      if (!scannedId) return

      console.log("🎯 Raw Scanned Text:", scannedId)
      console.log("Sending student ID to API:", scannedId)

      const now = Date.now()
      const lastMarkedAt = recentScansRef.current.get(scannedId)
      if (lastMarkedAt && now - lastMarkedAt < 3000) {
        return
      }

      markingRef.current = true
      try {
        const result = await markAttendanceByScan(scannedId, classroomId, new Date().toISOString())
        recentScansRef.current.set(scannedId, now)
        const labeled = result.attendance.registration_no || scannedId
        setLastScan(`${result.attendance.student_name || "Student"} (${labeled})`)
        toast.success(
          `Attendance marked as Present for ${result.attendance.student_name || "Student"} (${labeled})!`,
        )
        await loadStudents()
      } catch (error) {
        if (isAlreadyScannedError(error)) {
          recentScansRef.current.set(scannedId, now)
          toast.message(getApiErrorMessage(error, "Already scanned for today!"))
          return
        }
        toast.error(getApiErrorMessage(error, `Failed to mark attendance for ${scannedId}`))
      } finally {
        markingRef.current = false
      }
    },
    [classroomId, loadStudents],
  )

  const startScanner = useCallback(
    async (facingMode: FacingMode) => {
      await stopScanner()

      const scanner = await startQrScanner(
        readerId,
        { facingMode },
        (value) => {
          void processScan(value)
        },
      )

      scannerRef.current = scanner
      setActiveFacingMode(facingMode)
      setCameraActive(true)
    },
    [readerId, stopScanner, processScan],
  )

  const resetDialogState = useCallback(() => {
    setLastScan(null)
    setCameraActive(false)
    setCameraStarting(false)
    setCameraError(null)
    setActiveFacingMode("environment")
    setStudentsReady(false)
    recentScansRef.current.clear()
    void stopScanner()
  }, [stopScanner])

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const data = await getClassroomAttendance(classroomId)
        if (!cancelled) {
          recordsRef.current = data.records
          setStudentsReady(true)
        }
      } catch {
        if (!cancelled) {
          toast.error("Failed to load students for this classroom")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, classroomId])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetDialogState()
    }
    onOpenChange(nextOpen)
  }

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
      await startScanner("environment")
    } catch (error) {
      setCameraActive(false)
      const message = getCameraErrorMessage(error)
      setCameraError(message)
      toast.error(message)
    } finally {
      setCameraStarting(false)
    }
  }

  async function handleSwitchCamera() {
    if (cameraStarting) {
      return
    }

    const nextFacingMode: FacingMode =
      activeFacingMode === "environment" ? "user" : "environment"

    setCameraError(null)
    setCameraStarting(true)

    try {
      await startScanner(nextFacingMode)
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
              className="min-h-[280px] w-full [&_img]:hidden [&_video]:max-h-[320px] [&_video]:w-full [&_video]:object-cover"
            />

            {cameraActive && !cameraStarting && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div
                  className="relative rounded-md border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                  style={{ width: 250, height: 250 }}
                >
                  <div className="absolute -top-0.5 -left-0.5 size-6 border-t-4 border-l-4 border-emerald-400" />
                  <div className="absolute -top-0.5 -right-0.5 size-6 border-t-4 border-r-4 border-emerald-400" />
                  <div className="absolute -bottom-0.5 -left-0.5 size-6 border-b-4 border-l-4 border-emerald-400" />
                  <div className="absolute -right-0.5 -bottom-0.5 size-6 border-r-4 border-b-4 border-emerald-400" />
                </div>
              </div>
            )}

            {!cameraActive && (
              <div className="absolute inset-0 z-20 flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/80">
                <p>
                  {loadingStudents || !studentsReady
                    ? "Loading students..."
                    : "Your browser will ask to use the camera. Click Allow when prompted."}
                </p>
                <Button
                  type="button"
                  onClick={() => void handleEnableCamera()}
                  disabled={loadingStudents || !studentsReady || cameraStarting}
                >
                  <Camera className="size-4" />
                  {cameraStarting ? "Starting camera..." : "Allow Camera Access"}
                </Button>
              </div>
            )}

            {cameraActive && cameraStarting && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 text-sm text-white/80">
                Switching camera...
              </div>
            )}
          </div>

          {cameraActive && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleSwitchCamera()}
              disabled={cameraStarting}
            >
              <SwitchCamera className="size-4" />
              Switch Camera
            </Button>
          )}

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
