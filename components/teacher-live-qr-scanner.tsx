"use client"

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, SwitchCamera } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { getApiErrorMessage } from "@/lib/api-errors"
import { scanCenterAttendance } from "@/services/attendance"
import type { Attendance } from "@/types"

type FacingMode = "environment" | "user"

interface TeacherLiveQrScannerProps {
  classroomId?: number
  onMarked?: (attendance: Attendance) => void
}

const SCAN_BOX_SIZE = 250

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

function buildScanConfig() {
  return {
    fps: 10,
    // Keep the scan region within the actual video frame (prevents silent scan failures).
    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
      const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
      const size = Math.max(180, Math.min(SCAN_BOX_SIZE, Math.floor(minEdge * 0.75)))
      return { width: size, height: size }
    },
    aspectRatio: 1.777778,
    disableFlip: false,
  }
}

async function startQrScanner(
  elementId: string,
  facingMode: FacingMode,
  onScanSuccess: (decodedText: string) => void,
): Promise<Html5Qrcode> {
  const scanConfig = buildScanConfig()
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
          onScanSuccess(decodedText)
        },
        (errorMessage) => {
          // Continuous "not found" frames are expected; log sparsely for debugging.
          if (Math.random() < 0.01) {
            console.debug("[QR] scan frame:", errorMessage)
          }
        },
      )
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
  const processScanRef = useRef<(value: string) => void>(() => {})

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
      console.log("🎯 Raw Scanned Text:", rawValue)

      if (markingRef.current) return

      // Use the exact scanned QR text — do not substitute another student's ID.
      const scannedId = rawValue.trim()
      if (!scannedId) return

      console.log("Sending student ID to API:", scannedId)

      const now = Date.now()
      const lastMarkedAt = recentScansRef.current.get(scannedId)
      if (lastMarkedAt && now - lastMarkedAt < 3000) return

      markingRef.current = true
      try {
        const result = await scanCenterAttendance({
          scannedStudentId: scannedId,
          classroomId,
        })
        recentScansRef.current.set(scannedId, now)
        const labeled =
          result.attendance.registration_no ||
          result.attendance.student_name ||
          scannedId
        setLastScan(`${labeled} ← scanned ${scannedId}`)
        toast.success(
          `Marked present: ${result.attendance.student_name || "Student"} (${result.attendance.registration_no || scannedId})`,
        )
        onMarked?.(result.attendance)
      } catch (error) {
        toast.error(getApiErrorMessage(error, `Failed to mark attendance for ${scannedId}`))
      } finally {
        markingRef.current = false
      }
    },
    [classroomId, onMarked],
  )

  // Keep the Html5Qrcode callback stable across re-renders.
  useEffect(() => {
    processScanRef.current = (value: string) => {
      void processScan(value)
    }
  }, [processScan])

  const startScanner = useCallback(
    async (mode: FacingMode) => {
      await stopScanner()
      // Let the reader element remount/clear before restarting.
      await new Promise((resolve) => setTimeout(resolve, 150))

      const scanner = await startQrScanner(readerId, mode, (decodedText) => {
        processScanRef.current(decodedText)
      })
      scannerRef.current = scanner
      setFacingMode(mode)
      setCameraActive(true)
    },
    [stopScanner],
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
      <div className="relative min-h-[320px] overflow-hidden rounded-lg border bg-black">
        <div
          id={readerId}
          className="min-h-[320px] w-full [&_img]:hidden [&_video]:max-h-[360px] [&_video]:w-full [&_video]:object-cover"
        />

        {/* Visible alignment guide for the user */}
        {cameraActive && !cameraStarting && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div
              className="relative rounded-md border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              style={{ width: SCAN_BOX_SIZE, height: SCAN_BOX_SIZE }}
            >
              <div className="absolute -top-0.5 -left-0.5 size-6 border-t-4 border-l-4 border-emerald-400" />
              <div className="absolute -top-0.5 -right-0.5 size-6 border-t-4 border-r-4 border-emerald-400" />
              <div className="absolute -bottom-0.5 -left-0.5 size-6 border-b-4 border-l-4 border-emerald-400" />
              <div className="absolute -right-0.5 -bottom-0.5 size-6 border-r-4 border-b-4 border-emerald-400" />
            </div>
          </div>
        )}

        {!cameraActive && (
          <div className="absolute inset-0 z-20 flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/80">
            <p>Allow camera access to start live QR attendance scanning.</p>
            <p className="text-white/60 text-xs">Align the student QR code inside the square frame.</p>
            <Button type="button" onClick={() => void handleEnableCamera()} disabled={cameraStarting}>
              <Camera className="size-4" />
              {cameraStarting ? "Starting camera..." : "Start Live Scanner"}
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
        <>
          <p className="text-muted-foreground text-center text-xs">
            Hold the QR code steady inside the green square until it scans.
          </p>
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
        </>
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
