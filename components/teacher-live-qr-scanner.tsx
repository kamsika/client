"use client"

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, SwitchCamera } from "lucide-react"
import { toast } from "sonner"

import { ContinuousSubjectPicker } from "@/components/continuous-subject-picker"
import { Button } from "@/components/ui/button"
import { getApiErrorMessage, isAlreadyScannedError } from "@/lib/api-errors"
import {
  scanCenterAttendance,
  type AttendanceScanResponse,
  type SelectableAttendanceSubject,
} from "@/services/attendance"
import type { Attendance } from "@/types"

type PendingSubjectSelection = {
  scannedStudentId: string
  studentName: string
  registrationNo: string
  grade?: string | null
  classroomName?: string | null
  enrolledSubjects: string[]
  selectableSubjects: SelectableAttendanceSubject[]
  scheduledSubjects: SelectableAttendanceSubject[]
  continuousGroup: boolean
}

type FacingMode = "environment" | "user"

interface TeacherLiveQrScannerProps {
  classroomId?: number
  onMarked?: (attendance: Attendance) => void
}

const SCAN_BOX_SIZE = 250
/** Ignore repeat scans of the same QR for this long after a successful decode. */
const SCAN_COOLDOWN_MS = 3500
/** How long the green success flash stays visible. */
const SCAN_FLASH_MS = 900

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

/** html5-qrcode fires NotFoundException every frame with no QR — expected, not an error. */
function isNonFatalScanFrameError(error: unknown): boolean {
  if (error == null) return true

  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name ?? "")
      : ""
  const message = error instanceof Error ? error.message : String(error)

  return (
    name === "NotFoundException" ||
    /NotFoundException/i.test(message) ||
    /No MultiFormat Readers were able to detect the code/i.test(message) ||
    /QR code parse error/i.test(message) ||
    /No QR code found/i.test(message)
  )
}

function playScanBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = "sine"
    oscillator.frequency.value = 880
    gain.gain.value = 0.04
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12)
    oscillator.stop(ctx.currentTime + 0.14)
    window.setTimeout(() => {
      void ctx.close().catch(() => undefined)
    }, 200)
  } catch {
    // Audio may be blocked; visual flash is enough.
  }
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

/** Stop every MediaStream track under a reader root and detach the video. */
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

  // Release tracks first so the LED turns off even if library stop() is slow/hangs.
  releaseCameraMedia(container)

  if (scanner) {
    try {
      if (scanner.isScanning) {
        await scanner.stop()
      }
    } catch {
      // already stopped / element gone
    }
    try {
      scanner.clear()
    } catch {
      // clear() throws if the element was already removed
    }
  }

  // Second pass after html5-qrcode cleanup (covers leftover tracks).
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
          const value = String(decodedText ?? "").trim()
          if (!value) return
          onScanSuccess(value)
        },
        (errorMessage) => {
          // NotFoundException / "no QR in frame" fires continuously — never log it.
          if (isNonFatalScanFrameError(errorMessage)) return
          console.warn("[QR] scanner frame error:", errorMessage)
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
  const [scanFlash, setScanFlash] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<PendingSubjectSelection | null>(null)
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([])
  const [submittingSubjects, setSubmittingSubjects] = useState(false)
  const flashTimerRef = useRef<number | null>(null)

  const triggerScanFeedback = useCallback(() => {
    playScanBeep()
    setScanFlash(true)
    if (flashTimerRef.current != null) {
      window.clearTimeout(flashTimerRef.current)
    }
    flashTimerRef.current = window.setTimeout(() => {
      setScanFlash(false)
      flashTimerRef.current = null
    }, SCAN_FLASH_MS)
  }, [])

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    await destroyQrScanner(scanner, readerId)
    setCameraActive(false)
    setScanFlash(false)
  }, [readerId])

  const clearPendingSelection = useCallback(() => {
    setPendingSelection(null)
    setSelectedSubjectIds([])
  }, [])

  const applyScanResult = useCallback(
    (args: {
      scannedId: string
      result: AttendanceScanResponse
    }) => {
      const { scannedId, result } = args
      const attendance = result.attendance ?? result.data
      const name = result.studentName || attendance?.student_name || "Student"
      const regNo = result.registrationNo || attendance?.registration_no || scannedId
      const enrolled = result.enrolledSubjects ?? result.enrolled_subjects ?? []
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

      setLastScan(
        [
          `${name} (${regNo})`,
          enrolled.length ? `Enrolled: ${enrolled.join(", ")}` : null,
          newlyMarked.length || presentDetails.length
            ? `Marked: ${presentDetails.length ? presentDetails.join("; ") : newlyMarked.join(", ")}`
            : alreadyMarked.length
              ? alreadyDetails[0] || `Already marked for ${alreadyMarked.join(", ")}`
              : result.message ||
                `No active class scheduled at this time for ${name}`,
        ]
          .filter(Boolean)
          .join(" · "),
      )

      clearPendingSelection()

      if (subjects.length === 0 || result.status === "NoClass") {
        toast.message(
          <div className="space-y-1 text-sm">
            <p className="font-semibold">
              {name} · ID {regNo}
            </p>
            {enrolled.length > 0 && (
              <p>Enrolled: {enrolled.map((subject) => `[${subject}]`).join(" ")}</p>
            )}
            <p>
              {result.message ||
                `No active class scheduled at this time for ${name}`}
            </p>
          </div>,
        )
        return
      }

      if (
        result.status === "AlreadyMarked" ||
        (newlyMarked.length === 0 && alreadyMarked.length > 0)
      ) {
        toast.message(
          <div className="space-y-1 text-sm">
            <p className="font-semibold">
              {name} · ID {regNo}
            </p>
            {enrolled.length > 0 && (
              <p>Enrolled: {enrolled.map((subject) => `[${subject}]`).join(" ")}</p>
            )}
            <p>
              ⚠️{" "}
              {alreadyDetails[0] ||
                `Already marked for ${alreadyMarked.join(", ") || "current class"}.`}
            </p>
          </div>,
        )
        return
      }

      toast.success(
        <div className="space-y-1 text-sm">
          <p className="font-semibold">
            {name} · ID {regNo}
          </p>
          {enrolled.length > 0 && (
            <p>Enrolled: {enrolled.map((subject) => `[${subject}]`).join(" ")}</p>
          )}
          <p>
            ✅{" "}
            {presentDetails.length > 0
              ? presentDetails.join("; ")
              : newlyMarked.join(", ") || subjects.join(", ")}
          </p>
          {alreadyDetails.length > 0 && <p>⚠️ {alreadyDetails.join(" ")}</p>}
        </div>,
      )
      if (attendance) {
        onMarked?.(attendance)
      }
    },
    [clearPendingSelection, onMarked],
  )

  const submitSelectedSubjects = useCallback(async () => {
    if (!pendingSelection) return
    if (selectedSubjectIds.length === 0) {
      toast.error("Select at least one subject")
      return
    }

    setSubmittingSubjects(true)
    markingRef.current = true
    try {
      const result = await scanCenterAttendance({
        scannedStudentId: pendingSelection.scannedStudentId,
        classroomId,
        selectedSubjectIds,
      })
      recentScansRef.current.set(pendingSelection.scannedStudentId, Date.now())
      applyScanResult({
        scannedId: pendingSelection.scannedStudentId,
        result,
      })
    } catch (error) {
      if (isAlreadyScannedError(error)) {
        recentScansRef.current.set(pendingSelection.scannedStudentId, Date.now())
        toast.message(getApiErrorMessage(error, "Already scanned for today!"))
        clearPendingSelection()
        return
      }
      toast.error(
        getApiErrorMessage(
          error,
          `Failed to mark attendance for ${pendingSelection.scannedStudentId}`,
        ),
      )
    } finally {
      setSubmittingSubjects(false)
      markingRef.current = false
    }
  }, [
    applyScanResult,
    classroomId,
    clearPendingSelection,
    pendingSelection,
    selectedSubjectIds,
  ])

  const processScan = useCallback(
    async (rawValue: string) => {
      if (markingRef.current || pendingSelection) return

      // Use the exact scanned QR text — do not substitute another student's ID.
      const scannedId = rawValue.trim()
      if (!scannedId) return

      const now = Date.now()
      const lastMarkedAt = recentScansRef.current.get(scannedId)
      if (lastMarkedAt && now - lastMarkedAt < SCAN_COOLDOWN_MS) return

      // Immediate cooldown + feedback so duplicate frames never re-trigger.
      recentScansRef.current.set(scannedId, now)
      triggerScanFeedback()
      console.log("[QR] Decoded:", scannedId)

      markingRef.current = true
      try {
        // Phase 1: preview selectable continuous/current subjects (no mark yet).
        const result = await scanCenterAttendance({
          scannedStudentId: scannedId,
          classroomId,
        })

        const attendance = result.attendance ?? result.data
        const name =
          result.studentName || attendance?.student_name || "Student"
        const regNo =
          result.registrationNo || attendance?.registration_no || scannedId
        const enrolled = result.enrolledSubjects ?? result.enrolled_subjects ?? []
        const selectable =
          result.selectableSubjects ?? result.selectable_subjects ?? []
        const scheduled =
          result.scheduledSubjects ?? result.scheduled_subjects ?? []
        const needsSelection =
          result.status === "SelectSubjects" ||
          result.requiresSelection ||
          result.requires_selection

        if (result.status === "NoClass" || (needsSelection && selectable.length === 0)) {
          applyScanResult({ scannedId, result: { ...result, status: "NoClass" } })
          return
        }

        if (needsSelection && selectable.length > 0) {
          const defaults = selectable
            .filter((subject) => subject.defaultChecked !== false)
            .map((subject) => subject.id ?? subject.subjectId ?? 0)
            .filter((id) => id > 0)
          setSelectedSubjectIds(
            defaults.length > 0
              ? defaults
              : selectable
                  .map((subject) => subject.id ?? subject.subjectId ?? 0)
                  .filter((id) => id > 0),
          )
          setPendingSelection({
            scannedStudentId: scannedId,
            studentName: name,
            registrationNo: regNo,
            grade: result.grade ?? null,
            classroomName: result.classroomName ?? result.classroom_name ?? null,
            enrolledSubjects: enrolled,
            selectableSubjects: selectable,
            scheduledSubjects: scheduled,
            continuousGroup: Boolean(result.continuousGroup ?? result.continuous_group),
          })
          setLastScan(
            `${name} (${regNo}) · Select ${
              result.continuousGroup ? "continuous classes" : "current class"
            }`,
          )
          return
        }

        applyScanResult({ scannedId, result })
      } catch (error) {
        if (isAlreadyScannedError(error)) {
          toast.message(getApiErrorMessage(error, "Already scanned for today!"))
          return
        }
        toast.error(getApiErrorMessage(error, `Failed to mark attendance for ${scannedId}`))
      } finally {
        markingRef.current = false
      }
    },
    [applyScanResult, classroomId, pendingSelection, triggerScanFeedback],
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
      // Sync track stop in cleanup so unmount/navigation always kills the LED.
      const scanner = scannerRef.current
      scannerRef.current = null
      if (flashTimerRef.current != null) {
        window.clearTimeout(flashTimerRef.current)
      }
      const container = document.getElementById(readerId)
      releaseCameraMedia(container)
      void destroyQrScanner(scanner, readerId)
    }
  }, [readerId])

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

  async function handleStopCamera() {
    if (cameraStarting) return
    setCameraStarting(true)
    try {
      await stopScanner()
      clearPendingSelection()
      setCameraError(null)
    } finally {
      setCameraStarting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={`relative min-h-[320px] overflow-hidden rounded-lg border bg-black transition-[box-shadow,border-color] duration-200 ${
          scanFlash
            ? "border-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.65)]"
            : "border-border"
        }`}
      >
        <div
          id={readerId}
          className="min-h-[320px] w-full [&_img]:hidden [&_video]:max-h-[360px] [&_video]:w-full [&_video]:object-cover"
        />

        {/* Visible alignment guide for the user */}
        {cameraActive && !cameraStarting && !pendingSelection && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div
              className={`relative rounded-md border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] transition-colors duration-200 ${
                scanFlash ? "border-emerald-400" : "border-white/90"
              }`}
              style={{ width: SCAN_BOX_SIZE, height: SCAN_BOX_SIZE }}
            >
              <div
                className={`absolute -top-0.5 -left-0.5 size-6 border-t-4 border-l-4 ${
                  scanFlash ? "border-emerald-300" : "border-emerald-400"
                }`}
              />
              <div
                className={`absolute -top-0.5 -right-0.5 size-6 border-t-4 border-r-4 ${
                  scanFlash ? "border-emerald-300" : "border-emerald-400"
                }`}
              />
              <div
                className={`absolute -bottom-0.5 -left-0.5 size-6 border-b-4 border-l-4 ${
                  scanFlash ? "border-emerald-300" : "border-emerald-400"
                }`}
              />
              <div
                className={`absolute -right-0.5 -bottom-0.5 size-6 border-r-4 border-b-4 ${
                  scanFlash ? "border-emerald-300" : "border-emerald-400"
                }`}
              />
              {scanFlash && (
                <div className="absolute inset-0 flex items-center justify-center rounded-md bg-emerald-400/15">
                  <span className="rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-emerald-950">
                    QR detected
                  </span>
                </div>
              )}
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

      {pendingSelection && (
        <div className="space-y-2 rounded-lg border p-3">
          <div>
            <p className="font-medium">
              {pendingSelection.studentName} · ID {pendingSelection.registrationNo}
            </p>
            {(pendingSelection.grade || pendingSelection.classroomName) && (
              <p className="text-muted-foreground text-xs">
                {[
                  pendingSelection.grade ? `Grade ${pendingSelection.grade}` : null,
                  pendingSelection.classroomName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {pendingSelection.enrolledSubjects.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Enrolled: {pendingSelection.enrolledSubjects.join(", ")}
              </p>
            )}
          </div>
          <ContinuousSubjectPicker
            subjects={pendingSelection.selectableSubjects}
            scheduledSubjects={pendingSelection.scheduledSubjects}
            selectedIds={selectedSubjectIds}
            onChange={setSelectedSubjectIds}
            continuousGroup={pendingSelection.continuousGroup}
            submitting={submittingSubjects}
            onSubmit={() => void submitSelectedSubjects()}
            onCancel={clearPendingSelection}
          />
        </div>
      )}

      {cameraActive && (
        <>
          <p className="text-muted-foreground text-center text-xs">
            {pendingSelection
              ? "Scanning paused while you select subjects. Cancel to resume."
              : "Hold the QR code steady inside the green square until it scans."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => void handleSwitchCamera()}
              disabled={cameraStarting || Boolean(pendingSelection)}
            >
              <SwitchCamera className="size-4" />
              Switch Camera
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

      {cameraError && <p className="text-destructive text-sm">{cameraError}</p>}

      {lastScan && (
        <p className="text-muted-foreground text-sm">
          Last scanned: <span className="text-foreground font-medium">{lastScan}</span>
        </p>
      )}
    </div>
  )
}
