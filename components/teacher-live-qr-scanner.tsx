"use client"

import { Html5Qrcode } from "html5-qrcode"
import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, SwitchCamera } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { getApiErrorMessage } from "@/lib/api-errors"
import { getScannedStudentId, parseStudentQr } from "@/lib/parse-student-qr"
import { scanCenterAttendance } from "@/services/attendance"
import type { Attendance } from "@/types"

type FacingMode = "environment" | "user"

interface TeacherLiveQrScannerProps {
  classroomId?: number
  onMarked?: (attendance: Attendance) => void
}

function getCameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera permission was denied. Allow camera access and try again."
    }
    if (error.name === "NotFoundError") {
      return "No camera was found on this device."
    }
    if (error.name === "NotReadableError") {
      return "The camera is in use by another app."
    }
  }

  const message = error instanceof Error ? error.message : String(error ?? "")
  if (/secure context|https|localhost/i.test(message)) {
    return "Camera requires HTTPS or localhost."
  }
  return message || "Unable to access the camera."
}

async function startQrScanner(
  elementId: string,
  facingMode: FacingMode,
  onScan: (value: string) => void,
): Promise<Html5Qrcode> {
  const scanConfig = {
    fps: 10,
    qrbox: { width: 240, height: 240 },
  }
  const attempts: Array<string | MediaTrackConstraints> =
    facingMode === "environment"
      ? [{ facingMode: { exact: "environment" } }, { facingMode: "environment" }]
      : [{ facingMode: "user" }]

  const cameras = await Html5Qrcode.getCameras().catch(() => [] as { id: string; label: string }[])
  for (const camera of cameras) {
    attempts.push(camera.id)
  }

  let lastError: unknown = null
  for (const cameraIdOrConfig of attempts) {
    const scanner = new Html5Qrcode(elementId, { verbose: false })
    try {
      await scanner.start(cameraIdOrConfig, scanConfig, onScan, () => {})
      return scanner
    } catch (error) {
      lastError = error
      try {
        if (scanner.isScanning) await scanner.stop()
        scanner.clear()
      } catch {
        // ignore cleanup errors
      }
    }
  }

  throw lastError ?? new Error("Unable to start camera")
}

export function TeacherLiveQrScanner({ classroomId, onMarked }: TeacherLiveQrScannerProps) {
  const readerId = "teacher-live-qr-reader"
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const markingRef = useRef(false)
  const recentScansRef = useRef<Map<string, number>>(new Map())

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<FacingMode>("environment")
  const [lastScan, setLastScan] = useState<string | null>(null)

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      if (scanner.isScanning) await scanner.stop()
    } catch {
      // already stopped
    } finally {
      try {
        scanner.clear()
      } catch {
        // ignore
      }
    }
  }, [])

  const processScan = useCallback(
    async (rawValue: string) => {
      if (markingRef.current) return

      const trimmed = rawValue.trim()
      const scannedData = getScannedStudentId(trimmed)
      if (!scannedData) return

      const parsed = parseStudentQr(trimmed)
      const registrationNo = parsed?.registrationNo || scannedData
      if (!registrationNo) return

      const now = Date.now()
      const lastMarkedAt = recentScansRef.current.get(registrationNo)
      if (lastMarkedAt && now - lastMarkedAt < 3000) return

      markingRef.current = true
      try {
        const result = await scanCenterAttendance(registrationNo, classroomId)
        recentScansRef.current.set(registrationNo, now)
        setLastScan(registrationNo)
        toast.success(`Marked present: ${registrationNo}`)
        onMarked?.(result.attendance)
      } catch (error) {
        toast.error(getApiErrorMessage(error, `Failed to mark ${registrationNo}`))
      } finally {
        markingRef.current = false
      }
    },
    [classroomId, onMarked],
  )

  const startScanner = useCallback(
    async (mode: FacingMode) => {
      await stopScanner()
      const scanner = await startQrScanner(readerId, mode, (value) => {
        void processScan(value)
      })
      scannerRef.current = scanner
      setFacingMode(mode)
      setCameraActive(true)
    },
    [processScan, stopScanner],
  )

  useEffect(() => {
    return () => {
      void stopScanner()
    }
  }, [stopScanner])

  async function handleEnableCamera() {
    setCameraError(null)
    if (typeof window !== "undefined" && !window.isSecureContext) {
      const message = getCameraErrorMessage(new Error("secure context"))
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
    if (cameraStarting) return
    const nextMode: FacingMode = facingMode === "environment" ? "user" : "environment"
    setCameraError(null)
    setCameraStarting(true)
    try {
      await startScanner(nextMode)
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
    <div className="space-y-3">
      <div className="relative min-h-[280px] overflow-hidden rounded-lg border bg-black">
        <div
          id={readerId}
          className="min-h-[280px] w-full [&_video]:max-h-[320px] [&_video]:w-full [&_video]:object-cover"
        />

        {!cameraActive && (
          <div className="absolute inset-0 flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/80">
            <p>Allow camera access to start live QR attendance scanning.</p>
            <Button type="button" onClick={() => void handleEnableCamera()} disabled={cameraStarting}>
              <Camera className="size-4" />
              {cameraStarting ? "Starting camera..." : "Start Live Scanner"}
            </Button>
          </div>
        )}

        {cameraActive && cameraStarting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-white/80">
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

      {cameraError && <p className="text-destructive text-sm">{cameraError}</p>}

      {lastScan && (
        <p className="text-muted-foreground text-sm">
          Last scanned: <span className="text-foreground font-medium">{lastScan}</span>
        </p>
      )}
    </div>
  )
}
