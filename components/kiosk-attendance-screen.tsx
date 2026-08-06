"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  CircleDot,
  Loader2,
  ScanFace,
  ShieldCheck,
  Video,
  VideoOff,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AttendanceSubjectSelectionDialog } from "@/components/attendance-subject-selection-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getApiErrorMessage, isAlreadyScannedError } from "@/lib/api-errors"
import {
  KIOSK_MATCH_THRESHOLD,
  clearFaceOverlay,
  createFaceMatcher,
  detectFacesWithBoxes,
  drawFaceOverlays,
  getCameraErrorMessage,
  loadFaceModels,
  matchWithFaceMatcher,
  playSuccessChime,
  startFaceCamera,
  stopFaceCamera,
  type FaceMatcherInstance,
} from "@/lib/face-recognition"
import { selectItems } from "@/lib/select-items"
import { markKioskAttendance, type AttendanceSubjectOption } from "@/services/attendance"
import { listClassrooms } from "@/services/classroom"
import { listFaceProfiles, type StudentFaceProfile } from "@/services/student-face"
import type { Classroom } from "@/types"

const DETECT_INTERVAL_MS = 300
/** Default per-student cooldown between kiosk attendance triggers (5–10s pause). */
export const KIOSK_COOLDOWN_MS = 7000
const FEEDBACK_MS = 5500

const primaryBtn =
  "gap-2 bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white"

const kioskOutlineOnVideo =
  "border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white"

interface KioskLogEntry {
  id: string
  studentId: number
  name: string
  registrationNo: string
  status: string
  timeLabel: string
  distance: number
  enrolledSubjects: string[]
  presentNowDetails: string[]
  alreadyMarkedDetails: string[]
  paymentStatus?: "Pending" | "Paid" | "Overdue"
}

interface RecognizedStudent {
  studentId: number
  name: string
  registrationNo: string
  grade?: string | null
  classroomName?: string | null
  /** present | already | noclass | mixed | unmatched */
  mode: "present" | "already" | "noclass" | "mixed" | "unmatched"
  status: string
  distance: number
  enrolledSubjects: string[]
  presentNowDetails: string[]
  alreadyMarkedDetails: string[]
  paymentStatus?: "Pending" | "Paid" | "Overdue"
}

interface KioskAttendanceScreenProps {
  /** Restrict to a single classroom (teacher classroom page). */
  fixedClassroomId?: number
  /** Milliseconds before the same student can trigger again (default 5000). */
  cooldownMs?: number
  matchThreshold?: number
  autoAttendance?: boolean
  soundNotification?: boolean
  cameraDeviceId?: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function formatClock(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function isWithinCooldown(
  recentDetections: Map<number, number>,
  studentId: number,
  now: number,
  cooldownMs: number,
) {
  const lastMarkedAt = recentDetections.get(studentId)
  return typeof lastMarkedAt === "number" && now - lastMarkedAt < cooldownMs
}

function pruneRecentDetections(
  recentDetections: Map<number, number>,
  now: number,
  cooldownMs: number,
) {
  for (const [studentId, markedAt] of recentDetections) {
    if (now - markedAt >= cooldownMs) {
      recentDetections.delete(studentId)
    }
  }
}

export function KioskAttendanceScreen({
  fixedClassroomId,
  cooldownMs = KIOSK_COOLDOWN_MS,
  matchThreshold = KIOSK_MATCH_THRESHOLD,
  autoAttendance = true,
  soundNotification = true,
  cameraDeviceId,
}: KioskAttendanceScreenProps = {}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const matcherRef = useRef<FaceMatcherInstance | null>(null)
  const profilesByIdRef = useRef<
    Map<
      number,
      {
        label: string
        registrationNo: string
        grade?: string | null
        enrolledSubjects: string[]
      }
    >
  >(new Map())
  /** studentId → last successful / attempted mark timestamp (ms). */
  const recentDetectionsRef = useRef<Map<number, number>>(new Map())
  /** Students marked Present / AlreadyMarked this kiosk session (for return visits). */
  const sessionMarkedRef = useRef<
    Map<
      number,
      {
        name: string
        registrationNo: string
        grade?: string | null
        enrolledSubjects: string[]
        alreadyMarkedDetails: string[]
        paymentStatus?: "Pending" | "Paid" | "Overdue"
      }
    >
  >(new Map())
  const lastAlreadyToastAtRef = useRef<Map<number, number>>(new Map())
  const markingRef = useRef(false)
  const detectingRef = useRef(false)
  const classroomIdRef = useRef<number | null>(null)
  const classroomNameRef = useRef<string | null>(null)
  const cooldownMsRef = useRef(cooldownMs)
  const matchThresholdRef = useRef(matchThreshold)
  const autoAttendanceRef = useRef(autoAttendance)
  const soundNotificationRef = useRef(soundNotification)
  const cameraDeviceIdRef = useRef(cameraDeviceId)
  /** Until this timestamp, skip new Present marks (camera preview stays on). */
  const recognitionPausedUntilRef = useRef(0)

  const [recognitionPausedUntil, setRecognitionPausedUntil] = useState(0)

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [classroomId, setClassroomId] = useState<string>(
    fixedClassroomId ? String(fixedClassroomId) : "",
  )
  const [profiles, setProfiles] = useState<StudentFaceProfile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [modelsReady, setModelsReady] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(true)
  const [matcherReady, setMatcherReady] = useState(false)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [detectedFaceCount, setDetectedFaceCount] = useState(0)
  const [detectionMessage, setDetectionMessage] = useState<string | null>(null)

  const [recognized, setRecognized] = useState<RecognizedStudent | null>(null)
  const [pendingSelection, setPendingSelection] = useState<{
    studentId: number
    studentName: string
    options: AttendanceSubjectOption[]
    paymentStatus?: "Pending" | "Paid" | "Overdue"
  } | null>(null)
  const [log, setLog] = useState<KioskLogEntry[]>([])
  const [clock, setClock] = useState(() => formatClock(new Date()))
  const [successPopup, setSuccessPopup] = useState<{
    open: boolean
    studentName: string
  }>({ open: false, studentName: "" })

  const enrolledCount = useMemo(
    () => profiles.filter((p) => p.descriptor && p.descriptor.length === 128).length,
    [profiles],
  )

  const selectedClassroom = classrooms.find((c) => String(c.id) === classroomId) ?? null

  useEffect(() => {
    classroomIdRef.current = classroomId ? Number(classroomId) : null
    classroomNameRef.current =
      classrooms.find((c) => String(c.id) === classroomId)?.name ??
      (fixedClassroomId ? `Classroom #${fixedClassroomId}` : null)
    // New classroom = reset cooldown / feedback scope.
    recentDetectionsRef.current.clear()
    sessionMarkedRef.current.clear()
    lastAlreadyToastAtRef.current.clear()
    recognitionPausedUntilRef.current = 0
    setRecognitionPausedUntil(0)
    setLog([])
    setRecognized(null)
  }, [classroomId, classrooms, fixedClassroomId])

  useEffect(() => {
    cooldownMsRef.current = cooldownMs
    matchThresholdRef.current = matchThreshold
    autoAttendanceRef.current = autoAttendance
    soundNotificationRef.current = soundNotification
    cameraDeviceIdRef.current = cameraDeviceId
  }, [cooldownMs, matchThreshold, autoAttendance, soundNotification, cameraDeviceId])

  useEffect(() => {
    if (!recognitionPausedUntil) return
    const remaining = recognitionPausedUntil - Date.now()
    if (remaining <= 0) {
      setRecognitionPausedUntil(0)
      return
    }
    const timer = window.setTimeout(() => setRecognitionPausedUntil(0), remaining)
    return () => window.clearTimeout(timer)
  }, [recognitionPausedUntil])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatClock(new Date())), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const rebuildMatcher = useCallback(async (items: StudentFaceProfile[]) => {
    const enrolled = items.filter((p) => p.descriptor && p.descriptor.length === 128)
    const byId = new Map(
      enrolled.map((p) => [
        p.id,
        {
          label: p.full_name || p.registration_no,
          registrationNo: p.registration_no,
          grade: p.grade ?? null,
          enrolledSubjects: p.enrolledSubjects ?? p.enrolled_subjects ?? [],
        },
      ]),
    )
    profilesByIdRef.current = byId

    const matcher = await createFaceMatcher(
      enrolled.map((p) => ({ id: p.id, descriptor: p.descriptor as number[] })),
      matchThresholdRef.current,
    )
    matcherRef.current = matcher
    setMatcherReady(Boolean(matcher))
  }, [matchThreshold])

  useEffect(() => {
    if (profiles.length > 0) {
      void rebuildMatcher(profiles)
    }
  }, [matchThreshold, profiles, rebuildMatcher])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        setLoadingProfiles(true)
        const [faceProfiles, classroomList] = await Promise.all([
          listFaceProfiles(),
          fixedClassroomId ? Promise.resolve([] as Classroom[]) : listClassrooms(),
        ])
        if (cancelled) return
        setProfiles(faceProfiles)
        if (!fixedClassroomId) {
          setClassrooms(classroomList)
          if (classroomList.length > 0) {
            setClassroomId((prev) => prev || String(classroomList[0].id))
          }
        }
        await rebuildMatcher(faceProfiles)
      } catch {
        if (!cancelled) toast.error("Failed to load student face profiles")
      } finally {
        if (!cancelled) setLoadingProfiles(false)
      }

      try {
        setModelsLoading(true)
        await loadFaceModels()
        if (!cancelled) setModelsReady(true)
      } catch {
        if (!cancelled) toast.error("Failed to load face recognition models from /models")
      } finally {
        if (!cancelled) setModelsLoading(false)
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
      if (videoRef.current) stopFaceCamera(videoRef.current)
    }
  }, [fixedClassroomId, rebuildMatcher])

  useEffect(() => {
    if (!recognized) return
    const timer = window.setTimeout(() => setRecognized(null), FEEDBACK_MS)
    return () => window.clearTimeout(timer)
  }, [recognized])

  const stopCameraTracks = useCallback(() => {
    if (videoRef.current) stopFaceCamera(videoRef.current)
    if (canvasRef.current) clearFaceOverlay(canvasRef.current)
  }, [])

  async function handleEnableCamera() {
    setCameraError(null)

    if (typeof window !== "undefined" && !window.isSecureContext) {
      const message = getCameraErrorMessage(new Error("secure context"))
      setCameraError(message)
      toast.error(message)
      return
    }

    if (!videoRef.current) return
    if (!classroomId && !fixedClassroomId) {
      toast.error("Select a classroom before starting the kiosk")
      return
    }

    if (enrolledCount === 0) {
      toast.message("Camera will start, but no faces are enrolled yet. Register students under Face Registration to mark attendance.")
    }

    setCameraStarting(true)
    try {
      if (!modelsReady) {
        await loadFaceModels()
        setModelsReady(true)
      }
      await startFaceCamera(videoRef.current, cameraDeviceIdRef.current)
      setCameraActive(true)
      setScanning(enrolledCount > 0)
    } catch (error) {
      stopCameraTracks()
      setCameraActive(false)
      setScanning(false)
      const message = getCameraErrorMessage(error)
      setCameraError(message)
      toast.error(message)
    } finally {
      setCameraStarting(false)
    }
  }

  function handleStopCamera() {
    stopCameraTracks()
    setCameraActive(false)
    setScanning(false)
    setDetectedFaceCount(0)
    setDetectionMessage(null)
    setRecognized(null)
    recentDetectionsRef.current.clear()
    sessionMarkedRef.current.clear()
    lastAlreadyToastAtRef.current.clear()
    recognitionPausedUntilRef.current = 0
    setRecognitionPausedUntil(0)
  }

  function pauseRecognitionAfterMark() {
    const until = Date.now() + cooldownMsRef.current
    recognitionPausedUntilRef.current = until
    setRecognitionPausedUntil(until)
  }

  const showAlreadyMarked = useCallback(
    (
      studentId: number,
      distance: number,
      extras?: {
        name?: string
        registrationNo?: string
        alreadyMarkedDetails?: string[]
        enrolledSubjects?: string[]
        paymentStatus?: "Pending" | "Paid" | "Overdue"
        toast?: boolean
      },
    ) => {
      const profile = profilesByIdRef.current.get(studentId)
      const cached = sessionMarkedRef.current.get(studentId)
      const name = extras?.name || cached?.name || profile?.label || `Student #${studentId}`
      const registrationNo =
        extras?.registrationNo || cached?.registrationNo || profile?.registrationNo || ""
      const alreadyMarkedDetails =
        extras?.alreadyMarkedDetails?.length
          ? extras.alreadyMarkedDetails
          : cached?.alreadyMarkedDetails?.length
            ? cached.alreadyMarkedDetails
            : ["Already marked for current class."]
      const enrolledSubjects =
        extras?.enrolledSubjects ??
        cached?.enrolledSubjects ??
        profile?.enrolledSubjects ??
        []
      const paymentStatus = extras?.paymentStatus ?? cached?.paymentStatus

      sessionMarkedRef.current.set(studentId, {
        name,
        registrationNo,
        grade: profile?.grade ?? cached?.grade ?? null,
        enrolledSubjects,
        alreadyMarkedDetails,
        paymentStatus,
      })

      setRecognized({
        studentId,
        name,
        registrationNo,
        grade: profile?.grade ?? cached?.grade ?? null,
        classroomName: classroomNameRef.current,
        mode: "already",
        status: alreadyMarkedDetails[0]?.replace(/\.$/, "") || "Already marked",
        distance,
        enrolledSubjects,
        presentNowDetails: [],
        alreadyMarkedDetails,
        paymentStatus,
      })
      setDetectionMessage("Already marked")

      if (extras?.toast !== false) {
        const lastToast = lastAlreadyToastAtRef.current.get(studentId) ?? 0
        if (Date.now() - lastToast > 4000) {
          lastAlreadyToastAtRef.current.set(studentId, Date.now())
          toast.message(alreadyMarkedDetails[0] || `${name} is already marked.`)
        }
      }
    },
    [],
  )

  const recordMatch = useCallback(async (studentId: number, distance: number) => {
    const now = Date.now()
    const cooldownWindow = cooldownMsRef.current

    // Returning student already marked this session — show "Already marked", don't re-mark.
    if (sessionMarkedRef.current.has(studentId)) {
      if (
        now < recognitionPausedUntilRef.current ||
        isWithinCooldown(recentDetectionsRef.current, studentId, now, cooldownWindow)
      ) {
        const lastAt = recentDetectionsRef.current.get(studentId) ?? 0
        // Keep the fresh Present success card briefly before switching to Already marked.
        if (now - lastAt < 2500) {
          return
        }
        showAlreadyMarked(studentId, distance, { toast: true })
        return
      }
      // Cooldown ended: still call API for authoritative subject labels, then show already.
    } else if (
      now < recognitionPausedUntilRef.current ||
      isWithinCooldown(recentDetectionsRef.current, studentId, now, cooldownWindow)
    ) {
      return
    }

    if (markingRef.current) {
      return
    }

    const activeClassroomId = classroomIdRef.current
    if (!activeClassroomId) {
      toast.error("Select a classroom to mark attendance")
      return
    }

    const profile = profilesByIdRef.current.get(studentId)
    const name = profile?.label ?? `Student #${studentId}`
    const registrationNo = profile?.registrationNo ?? ""

    markingRef.current = true

    try {
      const timestamp = new Date().toISOString()
      const result = await markKioskAttendance({
        studentId,
        classroomId: activeClassroomId,
        timestamp,
      })

      const enrolledSubjects =
        result.enrolledSubjects ?? result.enrolled_subjects ?? []
      const newlyMarked = result.newlyMarkedSubjects ?? []
      const alreadyMarked = result.alreadyMarkedSubjects ?? []
      const presentNowDetails = (result.presentNowDetails ?? []).map(
        (item) => item.label || `${item.subjectName ?? item.subject_name}`,
      )
      const alreadyMarkedDetails = (result.alreadyMarkedDetails ?? []).map(
        (item) =>
          item.label ||
          `Already marked for ${item.subjectName ?? item.subject_name}.`,
      )
      const attendanceOptions =
        result.attendanceOptions ?? result.attendance_options ?? []
      const paymentStatus =
        result.paymentStatus ?? result.payment_status ?? result.monthlyPayment?.payment_status

      const fallbackPresent =
        presentNowDetails.length > 0
          ? presentNowDetails
          : newlyMarked.map((subject) => `${subject} - Present`)
      const fallbackAlready =
        alreadyMarkedDetails.length > 0
          ? alreadyMarkedDetails
          : alreadyMarked.map((subject) => `Already marked for ${subject}.`)

      const displayName = result.studentName || name
      const displayReg = result.registrationNo || registrationNo

      let mode: RecognizedStudent["mode"] = "present"
      let statusLabel = "Present"
      if (result.status === "NoClass") {
        mode = "noclass"
        statusLabel = "No class now"
      } else if (
        result.status === "AlreadyMarked" ||
        (newlyMarked.length === 0 && alreadyMarked.length > 0) ||
        sessionMarkedRef.current.has(studentId)
      ) {
        mode = "already"
        statusLabel =
          alreadyMarked.length === 1
            ? `Already marked for ${alreadyMarked[0]}`
            : fallbackAlready[0]?.replace(/\.$/, "") || "Already marked for current class"
      } else if (newlyMarked.length > 0 && alreadyMarked.length > 0) {
        mode = "mixed"
        statusLabel = "Attendance Recorded Successfully"
      } else if (newlyMarked.length > 0) {
        mode = "present"
        statusLabel = "Attendance Recorded Successfully"
      }

      if (mode === "already") {
        const details =
          fallbackAlready.length > 0
            ? fallbackAlready
            : ["Already marked for current class."]
        sessionMarkedRef.current.set(studentId, {
          name: displayName,
          registrationNo: displayReg,
          grade: profile?.grade ?? null,
          enrolledSubjects,
          alreadyMarkedDetails: details,
          paymentStatus,
        })
        showAlreadyMarked(studentId, distance, {
          name: displayName,
          registrationNo: displayReg,
          alreadyMarkedDetails: details,
          enrolledSubjects,
          paymentStatus,
          toast: true,
        })
        pauseRecognitionAfterMark()
        recentDetectionsRef.current.set(studentId, Date.now())
        pruneRecentDetections(recentDetectionsRef.current, Date.now(), cooldownWindow)
        return
      }

      setRecognized({
        studentId,
        name: displayName,
        registrationNo: displayReg,
        grade: profile?.grade ?? null,
        classroomName: classroomNameRef.current,
        mode,
        status: statusLabel,
        distance,
        enrolledSubjects,
        presentNowDetails: fallbackPresent,
        alreadyMarkedDetails: fallbackAlready,
        paymentStatus,
      })

      if (attendanceOptions.length > 1) {
        setScanning(false)
        setPendingSelection({
          studentId,
          studentName: displayName,
          options: attendanceOptions,
          paymentStatus,
        })
      }

      if (mode === "noclass") {
        toast.message(
          `${displayName}: no timetable class at this time. Enrolled subjects shown only.`,
        )
        pauseRecognitionAfterMark()
        recentDetectionsRef.current.set(studentId, Date.now())
        pruneRecentDetections(recentDetectionsRef.current, Date.now(), cooldownWindow)
        return
      }

      // First successful Present (or mixed) this session — remember for return visits.
      sessionMarkedRef.current.set(studentId, {
        name: displayName,
        registrationNo: displayReg,
        grade: profile?.grade ?? null,
        enrolledSubjects,
        alreadyMarkedDetails:
          fallbackAlready.length > 0
            ? fallbackAlready
            : newlyMarked.map((subject) => `Already marked for ${subject}.`),
        paymentStatus,
      })

      pauseRecognitionAfterMark()
      recentDetectionsRef.current.set(studentId, Date.now())
      pruneRecentDetections(recentDetectionsRef.current, Date.now(), cooldownWindow)

      if (soundNotificationRef.current) {
        playSuccessChime()
      }
      setSuccessPopup({ open: true, studentName: displayName })
      toast.success("Face Updated Successfully")
      if (newlyMarked.length > 0) {
        toast.message(`Marked: ${newlyMarked.join(", ")}`)
      }
      if (alreadyMarked.length > 0) {
        toast.message(fallbackAlready.join(" "))
      }

      setLog((prev) => [
        {
          id: `${studentId}-${Date.now()}`,
          studentId,
          name: displayName,
          registrationNo: displayReg,
          status: mode === "present" || mode === "mixed" ? "Attendance Recorded Successfully" : statusLabel,
          timeLabel: formatClock(new Date()),
          distance,
          enrolledSubjects,
          presentNowDetails: fallbackPresent,
          alreadyMarkedDetails: fallbackAlready,
        },
        ...prev,
      ].slice(0, 40))
    } catch (error) {
      if (isAlreadyScannedError(error)) {
        const message = getApiErrorMessage(error, "Already marked for current class.")
        showAlreadyMarked(studentId, distance, {
          name,
          registrationNo,
          alreadyMarkedDetails: [message.endsWith(".") ? message : `${message}.`],
          enrolledSubjects: profile?.enrolledSubjects ?? [],
          toast: true,
        })
        pauseRecognitionAfterMark()
        recentDetectionsRef.current.set(studentId, Date.now())
        pruneRecentDetections(recentDetectionsRef.current, Date.now(), cooldownWindow)
      } else {
        recentDetectionsRef.current.delete(studentId)
        toast.error(getApiErrorMessage(error, `Failed to mark ${name}`))
      }
    } finally {
      markingRef.current = false
    }
  }, [showAlreadyMarked])

  async function confirmUpcomingClasses(selectedSubjects: string[]) {
    if (!pendingSelection) return
    const activeClassroomId = classroomIdRef.current
    if (!activeClassroomId) {
      toast.error("Select a classroom to confirm attendance")
      return
    }

    try {
      const result = await markKioskAttendance({
        studentId: pendingSelection.studentId,
        classroomId: activeClassroomId,
        timestamp: new Date().toISOString(),
        selectedSubjects,
      })
      const newlyMarked = result.newlyMarkedSubjects ?? []
      if (newlyMarked.length > 0) {
        setSuccessPopup({
          open: true,
          studentName: pendingSelection.studentName,
        })
        toast.success("Face Updated Successfully")
        toast.message(`Marked Present: ${newlyMarked.join(", ")}`)
      }
      pauseRecognitionAfterMark()
      recentDetectionsRef.current.set(pendingSelection.studentId, Date.now())
      const attendance = result.attendance ?? result.data
      if (attendance) {
        setRecognized((current) =>
          current
            ? {
                ...current,
                status: `Present · ${newlyMarked.join(", ") || "confirmed"}`,
              }
            : current,
        )
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to confirm class attendance"))
      throw error
    }
  }

  // Continuous detection loop (~300ms) — recognition only when exactly one face.
  useEffect(() => {
    if (!cameraActive || !modelsReady) {
      if (canvasRef.current) clearFaceOverlay(canvasRef.current)
      setDetectedFaceCount(0)
      setDetectionMessage(null)
      return
    }

    let cancelled = false

    const interval = window.setInterval(async () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || cancelled || detectingRef.current) {
        return
      }

      const now = Date.now()
      // During global pause, still recognize faces so returning students can see "Already marked".
      // New Present marks are blocked inside recordMatch.

      detectingRef.current = true
      try {
        const detections = await detectFacesWithBoxes(video)
        if (cancelled) return

        const faceCount = detections.length
        setDetectedFaceCount(faceCount)

        // 0 faces — no recognition
        if (faceCount === 0) {
          clearFaceOverlay(canvas)
          setDetectionMessage("No face detected. Please stand in front of the camera.")
          setRecognized((current) => (current?.mode === "unmatched" ? null : current))
          return
        }

        // Multiple faces — stop recognition, draw red boxes, ignore frame
        if (faceCount > 1) {
          drawFaceOverlays(
            canvas,
            video,
            detections.map((detection) => ({
              box: detection.box,
              label: "Multiple faces",
              severity: "multi" as const,
            })),
          )
          setDetectionMessage(
            "Multiple faces detected.\nPlease ensure only one student is in front of the camera.",
          )
          setRecognized((current) => (current?.mode === "unmatched" ? null : current))
          return
        }

        // Exactly one face — green box; recognition only when scanning is on
        const detection = detections[0]
        const matcher = matcherRef.current
        const canRecognize = Boolean(scanning && matcherReady && matcher)

        if (!canRecognize) {
          drawFaceOverlays(canvas, video, [
            {
              box: detection.box,
              label: "Ready",
              severity: "valid",
            },
          ])
          setDetectionMessage(
            scanning
              ? "One face detected. Waiting for face models…"
              : "One face detected. Resume scan to mark attendance.",
          )
          return
        }

        if (markingRef.current) {
          drawFaceOverlays(canvas, video, [
            {
              box: detection.box,
              label: "Processing…",
              severity: "valid",
            },
          ])
          return
        }

        const match = matchWithFaceMatcher(
          matcher!,
          detection.descriptor,
          profilesByIdRef.current,
        )

        if (!match) {
          drawFaceOverlays(canvas, video, [
            {
              box: detection.box,
              label: "Face not registered",
              severity: "unknown",
            },
          ])
          setDetectionMessage("Face not registered.")
          setRecognized({
            studentId: 0,
            name: "Unknown",
            registrationNo: "—",
            grade: null,
            classroomName: classroomNameRef.current,
            mode: "unmatched",
            status: "Face not registered.",
            distance: 0,
            enrolledSubjects: [],
            presentNowDetails: [],
            alreadyMarkedDetails: [],
          })
          return
        }

        const profile = profilesByIdRef.current.get(match.studentId)
        const alreadyKnown = sessionMarkedRef.current.has(match.studentId)
        drawFaceOverlays(canvas, video, [
          {
            box: detection.box,
            label: alreadyKnown ? `${match.label} · Already marked` : match.label,
            matched: true,
            severity: alreadyKnown ? "unknown" : "matched",
          },
        ])
        setDetectionMessage(alreadyKnown ? "Already marked" : null)

        if (!autoAttendanceRef.current) {
          return
        }

        // Prefer enrolled subjects from profile when marking UI shows before API returns.
        void recordMatch(match.studentId, match.distance).then(() => {
          setRecognized((current) => {
            if (!current || current.studentId !== match.studentId) return current
            if (current.enrolledSubjects.length > 0) return current
            return {
              ...current,
              grade: current.grade ?? profile?.grade ?? null,
              classroomName: current.classroomName ?? classroomNameRef.current,
              enrolledSubjects:
                current.enrolledSubjects.length > 0
                  ? current.enrolledSubjects
                  : profile?.enrolledSubjects ?? [],
            }
          })
        })
      } catch {
        // Ignore transient frame errors.
      } finally {
        detectingRef.current = false
      }
    }, DETECT_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [cameraActive, scanning, modelsReady, matcherReady, recordMatch])

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 lg:flex-row">
      <AttendanceSubjectSelectionDialog
        open={Boolean(pendingSelection)}
        studentName={pendingSelection?.studentName ?? "Student"}
        options={pendingSelection?.options ?? []}
        paymentStatus={pendingSelection?.paymentStatus}
        onOpenChange={(open) => {
          if (!open) {
            setPendingSelection(null)
            if (cameraActive) setScanning(true)
          }
        }}
        onConfirm={confirmUpcomingClasses}
      />

      <AlertDialog
        open={successPopup.open}
        onOpenChange={(open) => setSuccessPopup((current) => ({ ...current, open }))}
      >
        <AlertDialogContent className="border-[#A2D4ED]/60 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-[#05082E]">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Face Updated Successfully
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#0047AB]/80">
              {successPopup.studentName
                ? `Attendance marked Present for ${successPopup.studentName}.`
                : "Attendance has been marked Present successfully."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="bg-[#F9BF15] font-semibold text-[#05082E] hover:bg-[#E88D1D] hover:text-white"
              onClick={() => setSuccessPopup({ open: false, studentName: "" })}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Main kiosk stage */}
      <section className="relative flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-xl border border-[#A2D4ED]/50 bg-black shadow-[0_12px_40px_rgba(5,8,46,0.05)]">
        <div className="pointer-events-none absolute inset-0">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
            autoPlay
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        {/* Top status bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              ok={modelsReady}
              loading={modelsLoading}
              okLabel="Models loaded"
              badLabel="Models loading"
              icon={<ShieldCheck className="size-3.5" />}
            />
            <StatusPill
              ok={cameraActive}
              loading={cameraStarting}
              okLabel="Camera active"
              badLabel="Camera off"
              icon={cameraActive ? <Video className="size-3.5" /> : <VideoOff className="size-3.5" />}
            />
            <StatusPill
              ok={matcherReady}
              loading={loadingProfiles}
              okLabel={`${enrolledCount} faces enrolled`}
              badLabel="No faces enrolled"
              icon={<ScanFace className="size-3.5" />}
            />
            {scanning && cameraActive && recognitionPausedUntil <= Date.now() && detectedFaceCount === 1 && (
              <Badge
                variant="outline"
                className="gap-1.5 border-[#A2D4ED]/80 bg-[#ABD2F2]/90 text-[#0047AB]"
              >
                <CircleDot className="size-3 animate-pulse" />
                Scanning
              </Badge>
            )}
            {cameraActive && detectedFaceCount > 1 && (
              <Badge
                variant="outline"
                className="gap-1.5 border-red-300 bg-red-50 text-red-800"
              >
                <AlertTriangle className="size-3.5" />
                Multiple faces
              </Badge>
            )}
            {recognitionPausedUntil > Date.now() && (
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-200 bg-white/95 text-emerald-800"
              >
                <CheckCircle2 className="size-3.5" />
                Attendance Recorded Successfully
              </Badge>
            )}
          </div>
          <div className="font-mono text-sm text-white/80 tabular-nums">{clock}</div>
        </div>

        {cameraActive && detectionMessage && !recognized && (
          <div className="relative z-10 flex justify-center px-4 pt-2">
            <p className="max-w-md whitespace-pre-line rounded-lg border border-white/20 bg-black/65 px-4 py-2 text-center text-sm text-white/90">
              {detectionMessage}
            </p>
          </div>
        )}

        {/* Idle / error overlay */}
        {!cameraActive && (
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="rounded-full bg-white/10 p-5">
              <Camera className="size-10 text-white/80" />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Face Attendance Kiosk</h2>
              <p className="text-sm text-white/70">
                {modelsLoading || loadingProfiles
                  ? "Loading models and student face descriptors…"
                  : enrolledCount === 0
                    ? "No enrolled faces yet. Register students under Face Registration first."
                    : "Stand in front of the camera. Recognized students are marked Present automatically."}
              </p>
            </div>

            {!fixedClassroomId && (
              <div className="w-full max-w-xs">
                <Select
                  value={classroomId}
                  onValueChange={(value) => value && setClassroomId(value)}
                  items={selectItems(
                    classrooms.map((classroom) => ({
                      value: classroom.id,
                      label: classroom.name,
                    })),
                  )}
                >
                  <SelectTrigger className="w-full border-white/20 bg-white/10 text-white">
                    <SelectValue placeholder="Select classroom" />
                  </SelectTrigger>
                  <SelectContent>
                    {classrooms.map((classroom) => (
                      <SelectItem key={classroom.id} value={String(classroom.id)}>
                        {classroom.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {cameraError && <p className="max-w-sm text-sm text-red-200">{cameraError}</p>}

            <Button
              type="button"
              size="lg"
              className={primaryBtn}
              disabled={
                cameraStarting ||
                modelsLoading ||
                loadingProfiles ||
                (!classroomId && !fixedClassroomId)
              }
              onClick={() => void handleEnableCamera()}
            >
              {cameraStarting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Starting camera…
                </>
              ) : (
                <>
                  <Camera className="size-4" />
                  Start Camera
                </>
              )}
            </Button>
          </div>
        )}

        {/* Recognition feedback card */}
        {recognized && (
          <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center px-4">
            <div
              className={`flex w-full max-w-lg flex-col gap-3 rounded-2xl border px-5 py-4 shadow-[0_12px_40px_rgba(5,8,46,0.12)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-300 ${
                recognized.mode === "already"
                  ? "border-amber-200 bg-white/95"
                  : recognized.mode === "unmatched"
                    ? "border-red-200 bg-white/95"
                    : recognized.mode === "noclass"
                      ? "border-[#A2D4ED]/60 bg-white/95"
                      : "border-emerald-200 bg-white/95"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-bold ${
                    recognized.mode === "already"
                      ? "bg-amber-100 text-amber-900"
                      : recognized.mode === "unmatched"
                        ? "bg-red-100 text-red-800"
                        : "bg-[#A2D4ED]/50 text-[#0047AB]"
                  }`}
                >
                  {recognized.mode === "unmatched" ? "?" : initials(recognized.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-[#05082E]">
                    {recognized.mode === "unmatched" ? "Face not registered." : recognized.name}
                  </p>
                  {recognized.mode !== "unmatched" && (
                    <p className="truncate text-sm text-[#0047AB]/75">
                      ID: {recognized.registrationNo}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 gap-1 ${
                    recognized.mode === "already"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : recognized.mode === "unmatched"
                        ? "border-red-200 bg-red-50 text-red-800"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800"
                  }`}
                >
                  {recognized.mode === "already" || recognized.mode === "unmatched" ? (
                    <AlertTriangle className="size-3.5" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                  {recognized.mode === "unmatched"
                    ? "Not registered"
                    : recognized.mode === "present" || recognized.mode === "mixed"
                      ? "Present"
                      : recognized.status}
                </Badge>
              </div>

              {recognized.mode !== "unmatched" && (
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs tracking-wide text-[#0047AB]/60 uppercase">Grade</dt>
                    <dd className="font-medium text-[#05082E]">{recognized.grade || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-wide text-[#0047AB]/60 uppercase">Class</dt>
                    <dd className="font-medium text-[#05082E]">{recognized.classroomName || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs tracking-wide text-[#0047AB]/60 uppercase">
                      Mark Attendance
                    </dt>
                    <dd
                      className={`font-medium ${
                        recognized.mode === "already" ? "text-amber-900" : "text-emerald-800"
                      }`}
                    >
                      {recognized.mode === "already" ? "Already marked" : "Present"}
                    </dd>
                  </div>
                </dl>
              )}

              {recognized.enrolledSubjects.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium tracking-wide text-[#0047AB]/60 uppercase">
                    Subjects
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {recognized.enrolledSubjects.map((subject) => (
                      <Badge
                        key={subject}
                        variant="outline"
                        className="border-[#A2D4ED] bg-[#f8fbfe] text-[#0047AB]"
                      >
                        {subject}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {recognized.paymentStatus && (
                <div className="flex items-center gap-2 text-sm text-[#0047AB]/85">
                  <span className="text-[#0047AB]/60">Monthly fee:</span>
                  <Badge
                    variant="outline"
                    className={
                      recognized.paymentStatus === "Paid"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                    }
                  >
                    {recognized.paymentStatus}
                  </Badge>
                </div>
              )}

              {recognized.presentNowDetails.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium tracking-wide text-[#0047AB]/60 uppercase">
                    Marked Today / Present Now
                  </p>
                  <ul className="space-y-1 text-sm text-[#05082E]">
                    {recognized.presentNowDetails.map((detail) => (
                      <li key={detail} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {recognized.alreadyMarkedDetails.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium tracking-wide text-amber-800/80 uppercase">
                    Already Marked Warning
                  </p>
                  <ul className="space-y-1 text-sm text-amber-900">
                    {recognized.alreadyMarkedDetails.map((detail) => (
                      <li key={detail} className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[#E88D1D]" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom controls when live */}
        {cameraActive && (
          <div className="relative z-10 mt-auto flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 py-4">
            <div className="text-sm text-white/70">
              {selectedClassroom
                ? `Classroom: ${selectedClassroom.name}`
                : fixedClassroomId
                  ? `Classroom #${fixedClassroomId}`
                  : "Classroom selected"}
              <span className="mx-2 text-white/30">·</span>
              Threshold {KIOSK_MATCH_THRESHOLD}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={kioskOutlineOnVideo}
                disabled={!scanning && detectedFaceCount !== 1}
                title={
                  !scanning && detectedFaceCount !== 1
                    ? "Scan requires exactly one face in frame"
                    : undefined
                }
                onClick={() => setScanning((prev) => !prev)}
              >
                {scanning ? "Pause scan" : "Resume scan"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={kioskOutlineOnVideo}
                onClick={handleStopCamera}
              >
                Stop camera
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Recent attendance sidebar */}
      <aside className="flex w-full flex-col rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)] lg:w-80 xl:w-96">
        <div className="border-b border-[#A2D4ED]/40 px-4 py-3">
          <h3 className="font-semibold text-[#05082E]">Recent attendance</h3>
          <p className="text-xs text-[#0047AB]/70">
            Recent scans this session · {log.length} events
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {log.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-[#0047AB]/70">
              Recognized students will appear here as they are marked Present.
            </div>
          ) : (
            <ul className="divide-y divide-[#A2D4ED]/30">
              {log.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#A2D4ED]/40 text-xs font-semibold text-[#0047AB]">
                    {initials(entry.name)}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium text-[#05082E]">{entry.name}</p>
                    <p className="truncate text-xs text-[#0047AB]/70">
                      ID: {entry.registrationNo}
                    </p>
                    {entry.enrolledSubjects.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.enrolledSubjects.map((subject) => (
                          <Badge
                            key={subject}
                            variant="outline"
                            className="border-[#A2D4ED] text-[10px] text-[#0047AB]"
                          >
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {entry.presentNowDetails.length > 0 && (
                      <p className="text-[11px] text-emerald-800">
                        {entry.presentNowDetails.join(" · ")}
                      </p>
                    )}
                    {entry.alreadyMarkedDetails.length > 0 && (
                      <p className="text-[11px] text-amber-900">
                        {entry.alreadyMarkedDetails.join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant="secondary" className="text-[10px]">
                      {entry.status}
                    </Badge>
                    <p className="mt-1 font-mono text-[10px] text-[#0047AB]/60">
                      {entry.timeLabel}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}

function StatusPill({
  ok,
  loading,
  okLabel,
  badLabel,
  icon,
}: {
  ok: boolean
  loading?: boolean
  okLabel: string
  badLabel: string
  icon: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        loading
          ? "bg-white/10 text-white/70"
          : ok
            ? "bg-[#ABD2F2]/90 text-[#0047AB]"
            : "bg-[#F9BF15]/25 text-[#F9BF15]"
      }`}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : icon}
      {loading ? "…" : ok ? okLabel : badLabel}
    </span>
  )
}
