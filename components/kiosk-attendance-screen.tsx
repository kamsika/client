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

import { ContinuousSubjectPicker } from "@/components/continuous-subject-picker"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { markKioskAttendance, type SelectableAttendanceSubject } from "@/services/attendance"
import { listClassrooms } from "@/services/classroom"
import { listFaceProfiles, type StudentFaceProfile } from "@/services/student-face"
import type { Classroom } from "@/types"

const DETECT_INTERVAL_MS = 300
/** Default per-student cooldown between kiosk attendance triggers. */
export const KIOSK_COOLDOWN_MS = 5000
const FEEDBACK_MS = 5500

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
}

interface RecognizedStudent {
  studentId: number
  name: string
  registrationNo: string
  grade?: string | null
  classroomName?: string | null
  /** present | already | noclass | mixed | select */
  mode: "present" | "already" | "noclass" | "mixed" | "select"
  status: string
  distance: number
  enrolledSubjects: string[]
  presentNowDetails: string[]
  alreadyMarkedDetails: string[]
  selectableSubjects: SelectableAttendanceSubject[]
  scheduledSubjects: SelectableAttendanceSubject[]
  continuousGroup: boolean
  classroomId: number
}

interface KioskAttendanceScreenProps {
  /** Restrict to a single classroom (teacher classroom page). */
  fixedClassroomId?: number
  /** Milliseconds before the same student can trigger again (default 5000). */
  cooldownMs?: number
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
}: KioskAttendanceScreenProps = {}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const matcherRef = useRef<FaceMatcherInstance | null>(null)
  const profilesByIdRef = useRef<Map<number, { label: string; registrationNo: string }>>(new Map())
  /** studentId → last successful / attempted mark timestamp (ms). */
  const recentDetectionsRef = useRef<Map<number, number>>(new Map())
  const markingRef = useRef(false)
  const detectingRef = useRef(false)
  const classroomIdRef = useRef<number | null>(null)
  const cooldownMsRef = useRef(cooldownMs)

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

  const [recognized, setRecognized] = useState<RecognizedStudent | null>(null)
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([])
  const [submittingSubjects, setSubmittingSubjects] = useState(false)
  const [log, setLog] = useState<KioskLogEntry[]>([])
  const [clock, setClock] = useState(() => formatClock(new Date()))

  const enrolledCount = useMemo(
    () => profiles.filter((p) => p.descriptor && p.descriptor.length === 128).length,
    [profiles],
  )

  const selectedClassroom = classrooms.find((c) => String(c.id) === classroomId) ?? null

  useEffect(() => {
    classroomIdRef.current = classroomId ? Number(classroomId) : null
    // New classroom = reset cooldown / feedback scope.
    recentDetectionsRef.current.clear()
    setLog([])
    setRecognized(null)
    setSelectedSubjectIds([])
  }, [classroomId])

  useEffect(() => {
    cooldownMsRef.current = cooldownMs
  }, [cooldownMs])

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
        },
      ]),
    )
    profilesByIdRef.current = byId

    const matcher = await createFaceMatcher(
      enrolled.map((p) => ({ id: p.id, descriptor: p.descriptor as number[] })),
      KIOSK_MATCH_THRESHOLD,
    )
    matcherRef.current = matcher
    setMatcherReady(Boolean(matcher))
  }, [])

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
    if (!recognized || recognized.mode === "select") return
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

    setCameraStarting(true)
    try {
      if (!modelsReady) {
        await loadFaceModels()
        setModelsReady(true)
      }
      await startFaceCamera(videoRef.current)
      setCameraActive(true)
      setScanning(true)
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
    setRecognized(null)
    recentDetectionsRef.current.clear()
  }

  const applyMarkResult = useCallback(
    (args: {
      studentId: number
      name: string
      registrationNo: string
      distance: number
      result: Awaited<ReturnType<typeof markKioskAttendance>>
    }) => {
      const { studentId, name, registrationNo, distance, result } = args
      const enrolledSubjects = result.enrolledSubjects ?? result.enrolled_subjects ?? []
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
      const fallbackPresent =
        presentNowDetails.length > 0
          ? presentNowDetails
          : newlyMarked.map((subject) => `${subject} - Present`)
      const fallbackAlready =
        alreadyMarkedDetails.length > 0
          ? alreadyMarkedDetails
          : alreadyMarked.map((subject) => `Already marked for ${subject}.`)

      let mode: RecognizedStudent["mode"] = "present"
      let statusLabel = "Present"
      if (result.status === "NoClass") {
        mode = "noclass"
        statusLabel =
          result.message ||
          `No active class scheduled at this time for ${name}`
      } else if (
        result.status === "AlreadyMarked" ||
        (newlyMarked.length === 0 && alreadyMarked.length > 0)
      ) {
        mode = "already"
        statusLabel =
          alreadyMarked.length === 1
            ? `Already marked for ${alreadyMarked[0]}`
            : "Already marked for selected class"
      } else if (newlyMarked.length > 0 && alreadyMarked.length > 0) {
        mode = "mixed"
        statusLabel = `Present · ${newlyMarked.join(", ")}`
      } else if (newlyMarked.length > 0) {
        mode = "present"
        statusLabel = `Present · ${newlyMarked.join(", ")}`
      }

      setRecognized({
        studentId,
        name,
        registrationNo,
        grade: result.grade ?? null,
        classroomName: result.classroomName ?? result.classroom_name ?? null,
        mode,
        status: statusLabel,
        distance,
        enrolledSubjects,
        presentNowDetails: fallbackPresent,
        alreadyMarkedDetails: fallbackAlready,
        selectableSubjects: [],
        scheduledSubjects: result.scheduledSubjects ?? result.scheduled_subjects ?? [],
        continuousGroup: false,
        classroomId: classroomIdRef.current || 0,
      })
      setSelectedSubjectIds([])

      if (mode === "noclass") {
        toast.message(
          result.message ||
            `No active class scheduled at this time for ${name}`,
        )
        return
      }
      if (mode === "already") {
        toast.message(fallbackAlready[0] || statusLabel)
        return
      }

      playSuccessChime()
      if (newlyMarked.length > 0) toast.success(`Marked: ${newlyMarked.join(", ")}`)
      if (alreadyMarked.length > 0) toast.message(fallbackAlready.join(" "))

      setLog((prev) =>
        [
          {
            id: `${studentId}-${Date.now()}`,
            studentId,
            name,
            registrationNo,
            status: statusLabel,
            timeLabel: formatClock(new Date()),
            distance,
            enrolledSubjects,
            presentNowDetails: fallbackPresent,
            alreadyMarkedDetails: fallbackAlready,
          },
          ...prev,
        ].slice(0, 40),
      )
    },
    [],
  )

  const submitSelectedSubjects = useCallback(async () => {
    if (!recognized || recognized.mode !== "select") return
    if (selectedSubjectIds.length === 0) {
      toast.error("Select at least one subject")
      return
    }

    setSubmittingSubjects(true)
    try {
      const result = await markKioskAttendance({
        studentId: recognized.studentId,
        classroomId: recognized.classroomId,
        selectedSubjectIds,
      })
      applyMarkResult({
        studentId: recognized.studentId,
        name: recognized.name,
        registrationNo: recognized.registrationNo,
        distance: recognized.distance,
        result,
      })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to mark selected subjects"))
    } finally {
      setSubmittingSubjects(false)
    }
  }, [applyMarkResult, recognized, selectedSubjectIds])

  const recordMatch = useCallback(async (studentId: number, distance: number) => {
    const now = Date.now()
    const cooldownWindow = cooldownMsRef.current

    if (isWithinCooldown(recentDetectionsRef.current, studentId, now, cooldownWindow)) {
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

    recentDetectionsRef.current.set(studentId, now)
    pruneRecentDetections(recentDetectionsRef.current, now, cooldownWindow)
    markingRef.current = true

    try {
      // Phase 1: fetch selectable continuous/current subjects (no mark yet).
      const result = await markKioskAttendance({
        studentId,
        classroomId: activeClassroomId,
      })

      const displayName = result.studentName || name
      const displayReg = result.registrationNo || registrationNo
      const enrolledSubjects = result.enrolledSubjects ?? result.enrolled_subjects ?? []
      const selectable =
        result.selectableSubjects ?? result.selectable_subjects ?? []
      const scheduled =
        result.scheduledSubjects ?? result.scheduled_subjects ?? []
      const needsSelection =
        result.status === "SelectSubjects" ||
        result.requiresSelection ||
        result.requires_selection

      if (result.status === "NoClass" || selectable.length === 0) {
        const noClassMessage =
          result.message ||
          `No active class scheduled at this time for ${displayName}`
        setRecognized({
          studentId,
          name: displayName,
          registrationNo: displayReg,
          grade: result.grade ?? null,
          classroomName: result.classroomName ?? result.classroom_name ?? null,
          mode: "noclass",
          status: noClassMessage,
          distance,
          enrolledSubjects,
          presentNowDetails: [],
          alreadyMarkedDetails: [],
          selectableSubjects: [],
          scheduledSubjects: scheduled,
          continuousGroup: false,
          classroomId: activeClassroomId,
        })
        setSelectedSubjectIds([])
        toast.message(noClassMessage)
        return
      }

      if (needsSelection) {
        const defaults = selectable
          .filter((subject) => subject.defaultChecked !== false)
          .map((subject) => subject.id ?? subject.subjectId ?? 0)
          .filter((id) => id > 0)
        setSelectedSubjectIds(defaults.length > 0 ? defaults : selectable
          .map((subject) => subject.id ?? subject.subjectId ?? 0)
          .filter((id) => id > 0))
        setRecognized({
          studentId,
          name: displayName,
          registrationNo: displayReg,
          grade: result.grade ?? null,
          classroomName: result.classroomName ?? result.classroom_name ?? null,
          mode: "select",
          status: result.continuousGroup ? "Select continuous classes" : "Confirm class",
          distance,
          enrolledSubjects,
          presentNowDetails: [],
          alreadyMarkedDetails: [],
          selectableSubjects: selectable,
          scheduledSubjects: scheduled,
          continuousGroup: Boolean(result.continuousGroup ?? result.continuous_group),
          classroomId: activeClassroomId,
        })
        setScanning(false)
        return
      }

      applyMarkResult({
        studentId,
        name: displayName,
        registrationNo: displayReg,
        distance,
        result,
      })
    } catch (error) {
      if (isAlreadyScannedError(error)) {
        const message = getApiErrorMessage(error, "Already marked for current class.")
        setRecognized({
          studentId,
          name,
          registrationNo,
          mode: "already",
          status: message.replace(/\.$/, ""),
          distance,
          enrolledSubjects: [],
          presentNowDetails: [],
          alreadyMarkedDetails: [message.endsWith(".") ? message : `${message}.`],
          selectableSubjects: [],
          scheduledSubjects: [],
          continuousGroup: false,
          classroomId: activeClassroomId,
        })
        toast.message(message)
      } else {
        recentDetectionsRef.current.delete(studentId)
        toast.error(getApiErrorMessage(error, `Failed to mark ${name}`))
      }
    } finally {
      markingRef.current = false
    }
  }, [applyMarkResult])

  // Continuous detection loop (~300ms).
  useEffect(() => {
    if (
      !cameraActive ||
      !scanning ||
      !modelsReady ||
      !matcherReady ||
      recognized?.mode === "select"
    ) {
      if (canvasRef.current && recognized?.mode === "select") clearFaceOverlay(canvasRef.current)
      return
    }

    let cancelled = false

    const interval = window.setInterval(async () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      const matcher = matcherRef.current
      if (!video || !canvas || !matcher || cancelled || detectingRef.current) {
        return
      }

      detectingRef.current = true
      try {
        const detections = await detectFacesWithBoxes(video)
        if (cancelled) return

        const overlays: Array<{
          box: (typeof detections)[0]["box"]
          label?: string
          matched?: boolean
          alreadyMarked?: boolean
        }> = []
        let bestMatch: { studentId: number; distance: number; label: string } | null = null

        for (const detection of detections) {
          const match = matchWithFaceMatcher(matcher, detection.descriptor, profilesByIdRef.current)
          if (match) {
            overlays.push({
              box: detection.box,
              label: match.label,
              matched: true,
            })
            if (!bestMatch || match.distance < bestMatch.distance) {
              bestMatch = match
            }
          } else {
            overlays.push({
              box: detection.box,
              label: "Unknown",
              matched: false,
            })
          }
        }

        drawFaceOverlays(canvas, video, overlays)

        if (!bestMatch || markingRef.current) {
          return
        }

        if (
          isWithinCooldown(
            recentDetectionsRef.current,
            bestMatch.studentId,
            Date.now(),
            cooldownMsRef.current,
          )
        ) {
          return
        }

        await recordMatch(bestMatch.studentId, bestMatch.distance)
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
  }, [cameraActive, scanning, modelsReady, matcherReady, recognized?.mode, recordMatch])

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 lg:flex-row">
      {/* Main kiosk stage */}
      <section className="relative flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-xl">
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
            autoPlay
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
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
            {scanning && cameraActive && (
              <Badge className="gap-1.5 border-0 bg-emerald-500/20 text-emerald-300">
                <CircleDot className="size-3 animate-pulse" />
                Scanning
              </Badge>
            )}
          </div>
          <div className="font-mono text-sm text-white/80 tabular-nums">{clock}</div>
        </div>

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
                >
                  <SelectTrigger className="border-white/20 bg-white/10 text-white">
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

            {cameraError && <p className="max-w-sm text-sm text-red-300">{cameraError}</p>}

            <Button
              type="button"
              size="lg"
              className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
              disabled={
                cameraStarting ||
                modelsLoading ||
                loadingProfiles ||
                enrolledCount === 0 ||
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
                  Start Kiosk
                </>
              )}
            </Button>
          </div>
        )}

        {/* Recognition feedback card */}
        {recognized ? (
          <div
            className={
              recognized.mode === "select" ||
              (recognized.mode === "noclass" &&
                (recognized.scheduledSubjects?.length ?? 0) > 0)
                ? "pointer-events-auto absolute inset-x-0 bottom-20 z-20 flex justify-center px-4"
                : "pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center px-4"
            }
          >
            <div
              className={
                recognized.mode === "already"
                  ? "flex w-full max-w-lg flex-col gap-3 rounded-2xl border border-amber-400/40 bg-amber-950/90 px-5 py-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-300"
                  : recognized.mode === "noclass"
                    ? "flex w-full max-w-lg flex-col gap-3 rounded-2xl border border-white/20 bg-zinc-900/90 px-5 py-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-300"
                    : recognized.mode === "select"
                      ? "flex w-full max-w-lg flex-col gap-3 rounded-2xl border border-sky-400/40 bg-zinc-950/95 px-5 py-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-300"
                      : "flex w-full max-w-lg flex-col gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-950/90 px-5 py-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-300"
              }
            >
              <div className="flex items-center gap-4">
                <div
                  className={
                    recognized.mode === "already"
                      ? "flex size-16 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl font-bold text-amber-950"
                      : recognized.mode === "select"
                        ? "flex size-16 shrink-0 items-center justify-center rounded-full bg-sky-400 text-xl font-bold text-sky-950"
                        : "flex size-16 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-xl font-bold text-emerald-950"
                  }
                >
                  {initials(recognized.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-white">
                    {recognized.name}
                  </p>
                  <p className="truncate text-sm text-white/70">
                    ID: {recognized.registrationNo}
                  </p>
                  {(recognized.grade || recognized.classroomName) ? (
                    <p className="truncate text-xs text-white/55">
                      {[
                        recognized.grade ? `Grade ${recognized.grade}` : null,
                        recognized.classroomName,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                <Badge
                  className={
                    recognized.mode === "already"
                      ? "shrink-0 gap-1 border-0 bg-amber-400 text-amber-950"
                      : recognized.mode === "select"
                        ? "shrink-0 gap-1 border-0 bg-sky-400 text-sky-950"
                        : "shrink-0 gap-1 border-0 bg-emerald-400 text-emerald-950"
                  }
                >
                  {recognized.mode === "already" ? (
                    <AlertTriangle className="size-3.5" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                  {recognized.status}
                </Badge>
              </div>

              {recognized.enrolledSubjects.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium tracking-wide text-white/60 uppercase">
                    Enrolled Subjects
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {recognized.enrolledSubjects.map((subject) => (
                      <Badge key={subject} className="border-0 bg-sky-400/20 text-sky-100">
                        {subject}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {recognized.mode === "select" && recognized.selectableSubjects.length > 0 ? (
                <ContinuousSubjectPicker
                  subjects={recognized.selectableSubjects}
                  scheduledSubjects={recognized.scheduledSubjects ?? []}
                  selectedIds={selectedSubjectIds}
                  onChange={setSelectedSubjectIds}
                  continuousGroup={recognized.continuousGroup}
                  submitting={submittingSubjects}
                  onSubmit={() => void submitSelectedSubjects()}
                  onCancel={() => {
                    setRecognized(null)
                    setSelectedSubjectIds([])
                    setScanning(true)
                  }}
                  className="border-white/15 bg-black/40 text-white shadow-none [&_p]:text-white/70 [&_.text-muted-foreground]:text-white/60"
                />
              ) : null}

              {recognized.mode === "noclass" &&
              (recognized.scheduledSubjects?.length ?? 0) > 0 ? (
                <ContinuousSubjectPicker
                  subjects={[]}
                  scheduledSubjects={recognized.scheduledSubjects ?? []}
                  selectedIds={[]}
                  onChange={() => undefined}
                  submitting={false}
                  onSubmit={() => undefined}
                  onCancel={() => {
                    setRecognized(null)
                    setScanning(true)
                  }}
                  className="border-white/15 bg-black/40 text-white shadow-none [&_p]:text-white/70 [&_.text-muted-foreground]:text-white/60"
                />
              ) : null}

              {recognized.presentNowDetails.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium tracking-wide text-white/60 uppercase">
                    Marked Today / Present Now
                  </p>
                  <ul className="space-y-1 text-sm text-white">
                    {recognized.presentNowDetails.map((detail) => (
                      <li key={detail} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {recognized.alreadyMarkedDetails.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium tracking-wide text-amber-200/80 uppercase">
                    Already Marked Warning
                  </p>
                  <ul className="space-y-1 text-sm text-amber-50">
                    {recognized.alreadyMarkedDetails.map((detail) => (
                      <li key={detail} className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

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
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => setScanning((prev) => !prev)}
              >
                {scanning ? "Pause scan" : "Resume scan"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={handleStopCamera}
              >
                Stop camera
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Recent attendance sidebar */}
      <aside className="flex w-full flex-col rounded-2xl border bg-background lg:w-80 xl:w-96">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Recent attendance</h3>
          <p className="text-muted-foreground text-xs">
            Recent scans this session · {log.length} events
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {log.length === 0 ? (
            <div className="text-muted-foreground flex h-40 items-center justify-center px-4 text-center text-sm">
              Recognized students will appear here as they are marked Present.
            </div>
          ) : (
            <ul className="divide-y">
              {log.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {initials(entry.name)}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium">{entry.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      ID: {entry.registrationNo}
                    </p>
                    {entry.enrolledSubjects.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.enrolledSubjects.map((subject) => (
                          <Badge key={subject} variant="outline" className="text-[10px]">
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {entry.presentNowDetails.length > 0 && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        {entry.presentNowDetails.join(" · ")}
                      </p>
                    )}
                    {entry.alreadyMarkedDetails.length > 0 && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        {entry.alreadyMarkedDetails.join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant="secondary" className="text-[10px]">
                      {entry.status}
                    </Badge>
                    <p className="text-muted-foreground mt-1 font-mono text-[10px]">
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
            ? "bg-emerald-500/20 text-emerald-300"
            : "bg-amber-500/20 text-amber-200"
      }`}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : icon}
      {loading ? "…" : ok ? okLabel : badLabel}
    </span>
  )
}
