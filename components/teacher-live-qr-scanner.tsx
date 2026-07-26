"use client"

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Camera, SwitchCamera } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { AttendanceSubjectSelectionDialog } from "@/components/attendance-subject-selection-dialog"
import { getApiErrorMessage, isAlreadyScannedError } from "@/lib/api-errors"
import { getScannedStudentId } from "@/lib/parse-student-qr"
import { cn } from "@/lib/utils"
import { scanCenterAttendance, type AttendanceSubjectOption } from "@/services/attendance"
import type { Attendance } from "@/types"

type FacingMode = "environment" | "user"

interface TeacherLiveQrScannerProps {
  classroomId?: number
  onMarked?: (attendance: Attendance) => void
  /** When true, start the camera as soon as the component mounts. */
  autoStart?: boolean
}

type RecentScan = {
  id: string
  studentName: string
  studentId: string
  status: string
  at: number
}

const SCAN_BOX_SIZE = 250
const QR_RESCAN_COOLDOWN_MS = 15_000

function getCameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera permission denied. Allow camera access in your browser settings and try again."
    }
    if (error.name === "NotFoundError") {
      return "Camera unavailable. No camera was found on this device."
    }
    if (error.name === "NotReadableError") {
      return "Camera unavailable. It may be in use by another app."
    }
  }

  const message = error instanceof Error ? error.message : String(error ?? "")
  if (/NotAllowedError|Permission denied|permission/i.test(message)) {
    return "Camera permission denied. Allow camera access and try again."
  }
  if (/NotFoundError|Requested device not found/i.test(message)) {
    return "Camera unavailable. No camera was found on this device."
  }
  if (/secure context|https|localhost/i.test(message)) {
    return "Camera requires HTTPS or localhost."
  }
  return message || "Unable to access the camera."
}

function buildScanConfig() {
  return {
    fps: 10,
    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
      const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
      const size = Math.max(180, Math.min(SCAN_BOX_SIZE, Math.floor(minEdge * 0.75)))
      return { width: size, height: size }
    },
    aspectRatio: 1.777778,
    disableFlip: false,
  }
}

function releaseCameraMedia(root: ParentNode | null | undefined) {
  if (!root) return

  const videos = root.querySelectorAll("video")
  videos.forEach((video) => {
    const stream = video.srcObject
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          // already ended
        }
      })
    }
    try {
      video.pause()
    } catch {
      // ignore
    }
    video.srcObject = null
    video.removeAttribute("src")
    try {
      video.load()
    } catch {
      // ignore
    }
  })
}

async function destroyQrScanner(scanner: Html5Qrcode | null, readerElementId: string) {
  const container =
    typeof document !== "undefined" ? document.getElementById(readerElementId) : null

  releaseCameraMedia(container)

  if (scanner) {
    try {
      if (scanner.isScanning) {
        await scanner.stop()
      }
    } catch {
      // already stopped
    }
    try {
      scanner.clear()
    } catch {
      // clear() throws if element was removed
    }
  }

  releaseCameraMedia(
    typeof document !== "undefined" ? document.getElementById(readerElementId) : container,
  )
}

async function startQrScanner(
  elementId: string,
  facingMode: FacingMode,
  onScanSuccess: (decodedText: string) => void,
): Promise<Html5Qrcode> {
  const scanConfig = buildScanConfig()
  const attempts: Array<string | MediaTrackConstraints> =
    facingMode === "environment"
      ? [{ facingMode: { ideal: "environment" } }, { facingMode: "environment" }]
      : [{ facingMode: { ideal: "user" } }, { facingMode: "user" }]

  const cameras = await Html5Qrcode.getCameras().catch(() => [] as { id: string; label: string }[])
  const preferred = cameras.filter((camera) => {
    const label = camera.label.toLowerCase()
    if (facingMode === "environment") {
      return /back|rear|environment|world/i.test(label)
    }
    return /front|user|face/i.test(label)
  })
  for (const camera of preferred.length ? preferred : cameras) {
    attempts.push(camera.id)
  }

  let lastError: unknown = null
  for (const cameraIdOrConfig of attempts) {
    const el = document.getElementById(elementId)
    if (!el) {
      throw new Error("Scanner preview element is not ready")
    }

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
          onScanSuccess(decodedText)
        },
        () => {
          // Continuous "QR not found" frames are expected while aiming.
        },
      )
      return scanner
    } catch (error) {
      lastError = error
      await destroyQrScanner(scanner, elementId)
    }
  }

  throw lastError ?? new Error("Unable to start camera")
}

export function TeacherLiveQrScanner({
  classroomId,
  onMarked,
  autoStart = true,
}: TeacherLiveQrScannerProps) {
  const reactId = useId().replace(/:/g, "")
  const readerId = `teacher-live-qr-reader-${reactId}`
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const recentScansRef = useRef<Map<string, number>>(new Map())
  const inFlightRef = useRef<Set<string>>(new Set())
  const processScanRef = useRef<(value: string) => void>(() => {})

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanStatus, setScanStatus] = useState("Ready to scan")
  const [facingMode, setFacingMode] = useState<FacingMode>("environment")
  const [recentScans, setRecentScans] = useState<RecentScan[]>([])
  const [pendingSelection, setPendingSelection] = useState<{
    scannedId: string
    studentName: string
    options: AttendanceSubjectOption[]
    paymentStatus?: "Pending" | "Paid" | "Overdue"
  } | null>(null)

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    await destroyQrScanner(scanner, readerId)
    setCameraActive(false)
  }, [readerId])

  const processScan = useCallback(
    async (rawValue: string) => {
      if (pendingSelection) return
      if (!classroomId) {
        toast.error("Select a classroom before scanning")
        setScanStatus("Select a classroom first")
        return
      }

      const scannedId = getScannedStudentId(rawValue)
      if (!scannedId) {
        toast.error("Invalid QR code")
        setScanStatus("Invalid QR code")
        return
      }

      const now = Date.now()
      for (const [id, scannedAt] of recentScansRef.current) {
        if (now - scannedAt >= QR_RESCAN_COOLDOWN_MS) {
          recentScansRef.current.delete(id)
        }
      }

      if (inFlightRef.current.has(scannedId)) return
      const lastMarkedAt = recentScansRef.current.get(scannedId)
      if (lastMarkedAt && now - lastMarkedAt < QR_RESCAN_COOLDOWN_MS) {
        setScanStatus(`Already scanned recently: ${scannedId}`)
        return
      }

      inFlightRef.current.add(scannedId)
      setScanStatus(`Scanning ${scannedId}…`)

      try {
        console.log("[QR] Sending student ID to API:", scannedId, "classroom:", classroomId)
        const result = await scanCenterAttendance({
          scannedStudentId: scannedId,
          classroomId,
        })

        const attendance = result.attendance ?? result.data
        const name = result.studentName || attendance?.student_name || "Student"
        const regNo =
          result.registrationNo || attendance?.registration_no || scannedId
        const subjects =
          result.markedAttendanceSubjects ??
          result.marked_attendance_subjects ??
          result.autoMarkedSubjects ??
          result.newlyMarkedSubjects ??
          []
        const newlyMarked = result.newlyMarkedSubjects ?? []
        const alreadyMarked = result.alreadyMarkedSubjects ?? []
        const presentDetails = (result.presentNowDetails ?? []).map(
          (item) => item.label || `${item.subjectName ?? item.subject_name}`,
        )
        const alreadyDetails = (result.alreadyMarkedDetails ?? []).map(
          (item) =>
            item.label || `Already marked for ${item.subjectName ?? item.subject_name}.`,
        )
        const attendanceOptions =
          result.attendanceOptions ?? result.attendance_options ?? []
        const paymentStatus =
          result.paymentStatus ?? result.payment_status ?? result.monthlyPayment?.payment_status

        if (attendanceOptions.length > 1) {
          setPendingSelection({
            scannedId,
            studentName: name,
            options: attendanceOptions,
            paymentStatus,
          })
        }

        const isAlready =
          result.status === "AlreadyMarked" ||
          (newlyMarked.length === 0 && alreadyMarked.length > 0)
        const isSuccess =
          result.status === "Present" ||
          newlyMarked.length > 0 ||
          subjects.length > 0 ||
          Boolean(attendance)

        // Only cooldown after a successful/recognized scan response.
        recentScansRef.current.set(scannedId, Date.now())

        setRecentScans((current) =>
          [
            {
              id: `${scannedId}-${Date.now()}`,
              studentName: name,
              studentId: regNo,
              status: isAlready ? "Already marked" : "Present",
              at: Date.now(),
            },
            ...current,
          ].slice(0, 8),
        )

        if (isAlready) {
          setScanStatus(`Already marked: ${name}`)
          toast.message(
            <div className="space-y-1 text-sm">
              <p className="font-semibold">
                {name} · ID {regNo}
              </p>
              <p>
                {alreadyDetails[0] ||
                  `Already marked for ${alreadyMarked.join(", ") || "today"}.`}
              </p>
            </div>,
          )
          return
        }

        if (isSuccess) {
          setScanStatus(`Marked Present: ${name}`)
          toast.success(
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Attendance marked successfully</p>
              <p>
                Name: <span className="font-medium">{name}</span>
              </p>
              <p>
                Student ID: <span className="font-mono text-xs">{regNo}</span>
              </p>
              {(presentDetails.length > 0 || newlyMarked.length > 0) && (
                <p>
                  {presentDetails.length > 0
                    ? presentDetails.join("; ")
                    : newlyMarked.join(", ")}
                </p>
              )}
            </div>,
          )
          if (attendance) onMarked?.(attendance)
          return
        }

        setScanStatus(`Scan completed for ${name}`)
        toast.message(
          <div className="space-y-1 text-sm">
            <p className="font-semibold">
              {name} · ID {regNo}
            </p>
            <p>{result.message || "Scan processed."}</p>
          </div>,
        )
      } catch (error) {
        // Allow retry after a failed mark.
        recentScansRef.current.delete(scannedId)
        if (isAlreadyScannedError(error)) {
          recentScansRef.current.set(scannedId, Date.now())
          setScanStatus(`Already marked: ${scannedId}`)
          toast.message(getApiErrorMessage(error, "Already scanned"))
          return
        }
        const message = getApiErrorMessage(error, `Failed to mark attendance for ${scannedId}`)
        setScanStatus(message)
        toast.error(message)
      } finally {
        inFlightRef.current.delete(scannedId)
      }
    },
    [classroomId, onMarked, pendingSelection],
  )

  async function confirmUpcomingClasses(selectedSubjects: string[]) {
    if (!pendingSelection || !classroomId) return
    try {
      const result = await scanCenterAttendance({
        scannedStudentId: pendingSelection.scannedId,
        classroomId,
        selectedSubjects,
      })
      const newlyMarked = result.newlyMarkedSubjects ?? []
      if (newlyMarked.length > 0) {
        toast.success(`Marked Present: ${newlyMarked.join(", ")}`)
      }
      const attendance = result.attendance ?? result.data
      if (attendance) onMarked?.(attendance)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to confirm class attendance"))
      throw error
    }
  }

  useEffect(() => {
    processScanRef.current = (value: string) => {
      void processScan(value)
    }
  }, [processScan])

  const startScanner = useCallback(
    async (mode: FacingMode) => {
      await stopScanner()
      await new Promise((resolve) => setTimeout(resolve, 120))

      const scanner = await startQrScanner(readerId, mode, (decodedText) => {
        processScanRef.current(decodedText)
      })
      scannerRef.current = scanner
      setFacingMode(mode)
      setCameraActive(true)
      setScanStatus("Camera ready — point at a student QR code")
    },
    [readerId, stopScanner],
  )

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current
      scannerRef.current = null
      const container = document.getElementById(readerId)
      releaseCameraMedia(container)
      void destroyQrScanner(scanner, readerId)
    }
  }, [readerId])

  async function handleEnableCamera(mode: FacingMode = "environment") {
    setCameraError(null)
    if (typeof window !== "undefined" && !window.isSecureContext) {
      const message = getCameraErrorMessage(new Error("secure context"))
      setCameraError(message)
      toast.error(message)
      return
    }

    setCameraStarting(true)
    setScanStatus("Starting camera…")
    try {
      await startScanner(mode)
    } catch (error) {
      setCameraActive(false)
      const message = getCameraErrorMessage(error)
      setCameraError(message)
      setScanStatus(message)
      toast.error(message)
    } finally {
      setCameraStarting(false)
    }
  }

  useEffect(() => {
    if (!autoStart || !classroomId) return
    let cancelled = false

    const timer = window.setTimeout(() => {
      if (cancelled) return
      void (async () => {
        setCameraError(null)
        if (typeof window !== "undefined" && !window.isSecureContext) {
          const message = getCameraErrorMessage(new Error("secure context"))
          setCameraError(message)
          toast.error(message)
          return
        }
        setCameraStarting(true)
        setScanStatus("Starting camera…")
        try {
          await startScanner("environment")
        } catch (error) {
          if (cancelled) return
          setCameraActive(false)
          const message = getCameraErrorMessage(error)
          setCameraError(message)
          setScanStatus(message)
          toast.error(message)
        } finally {
          if (!cancelled) setCameraStarting(false)
        }
      })()
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [autoStart, classroomId, startScanner])

  async function handleSwitchCamera() {
    if (cameraStarting) return
    const nextMode: FacingMode = facingMode === "environment" ? "user" : "environment"
    setCameraError(null)
    setCameraStarting(true)
    setScanStatus(
      nextMode === "environment" ? "Switching to back camera…" : "Switching to front camera…",
    )
    try {
      await startScanner(nextMode)
    } catch (error) {
      setCameraActive(false)
      const message = getCameraErrorMessage(error)
      setCameraError(message)
      setScanStatus(message)
      toast.error(message)
    } finally {
      setCameraStarting(false)
    }
  }

  async function handleStopCamera() {
    if (cameraStarting) return
    setCameraStarting(true)
    try {
      await stopScanner()
      setCameraError(null)
      setScanStatus("Camera stopped")
    } finally {
      setCameraStarting(false)
    }
  }

  return (
    <div className="space-y-4">
      <AttendanceSubjectSelectionDialog
        open={Boolean(pendingSelection)}
        studentName={pendingSelection?.studentName ?? "Student"}
        options={pendingSelection?.options ?? []}
        paymentStatus={pendingSelection?.paymentStatus}
        onOpenChange={(open) => {
          if (!open) setPendingSelection(null)
        }}
        onConfirm={confirmUpcomingClasses}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#A2D4ED]/50 bg-[#f8fbfe] px-3 py-2 text-sm">
        <span className="text-[#0047AB]/80">Scan status</span>
        <span className="font-medium text-[#05082E]">{scanStatus}</span>
      </div>

      <div className="relative min-h-[320px] overflow-hidden rounded-xl border border-[#A2D4ED]/50 bg-black">
        <div
          id={readerId}
          className="min-h-[320px] w-full [&_img]:hidden [&_video]:max-h-[360px] [&_video]:w-full [&_video]:object-cover"
        />

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
            <p className="text-xs text-white/60">
              Align the student QR code inside the square frame.
            </p>
            <Button
              type="button"
              onClick={() => void handleEnableCamera("environment")}
              disabled={cameraStarting || !classroomId}
            >
              <Camera className="size-4" />
              {cameraStarting ? "Starting camera..." : "Start Scanner"}
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
          <p className="text-center text-xs text-[#0047AB]/70">
            Hold the QR code steady inside the green square until it scans.
            {facingMode === "environment" ? " Using back camera." : " Using front camera."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-[#A2D4ED] text-[#0047AB]"
              onClick={() => void handleSwitchCamera()}
              disabled={cameraStarting}
            >
              <SwitchCamera className="size-4" />
              {facingMode === "environment" ? "Switch to Front" : "Switch to Back"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => void handleStopCamera()}
              disabled={cameraStarting}
            >
              Stop Scanner
            </Button>
          </div>
        </>
      )}

      {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}

      <div className="rounded-xl border border-[#A2D4ED]/50 bg-white p-4">
        <p className="text-sm font-semibold text-[#05082E]">Recent scanned students</p>
        {recentScans.length === 0 ? (
          <p className="mt-2 text-sm text-[#0047AB]/70">No scans yet this session.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#A2D4ED]/30">
            {recentScans.map((scan) => (
              <li
                key={scan.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#05082E]">{scan.studentName}</p>
                  <p className="font-mono text-xs text-[#0047AB]/75">{scan.studentId}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold",
                    scan.status === "Present"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-800",
                  )}
                >
                  {scan.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
