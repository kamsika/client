"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
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
import { markKioskAttendance } from "@/services/attendance"
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
  autoMarkedDetails: string[]
}

interface RecognizedStudent {
  studentId: number
  name: string
  registrationNo: string
  status: string
  distance: number
  enrolledSubjects: string[]
  autoMarkedDetails: string[]
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
  /** Students already marked successfully in this kiosk session (unique UI + API). */
  const markedStudentIdsRef = useRef<Set<number>>(new Set())
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
  const [log, setLog] = useState<KioskLogEntry[]>([])
  const [clock, setClock] = useState(() => formatClock(new Date()))

  const enrolledCount = useMemo(
    () => profiles.filter((p) => p.descriptor && p.descriptor.length === 128).length,
    [profiles],
  )

  const selectedClassroom = classrooms.find((c) => String(c.id) === classroomId) ?? null

  useEffect(() => {
    classroomIdRef.current = classroomId ? Number(classroomId) : null
    // New classroom = new session uniqueness scope.
    markedStudentIdsRef.current.clear()
    recentDetectionsRef.current.clear()
    setLog([])
    setRecognized(null)
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
    // Keep markedStudentIds for the session so restarting the camera
    // does not re-mark or re-log the same students.
  }

  const recordMatch = useCallback(async (studentId: number, distance: number) => {
    // Session uniqueness: never re-call API or append duplicate UI rows.
    if (markedStudentIdsRef.current.has(studentId)) {
      return
    }

    const now = Date.now()
    const cooldownWindow = cooldownMsRef.current

    // Short cooldown still blocks parallel frames before the set is updated.
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
      const timestamp = new Date().toISOString()
      const result = await markKioskAttendance({
        studentId,
        classroomId: activeClassroomId,
        timestamp,
      })

      // Mark as handled for this session before updating UI.
      markedStudentIdsRef.current.add(studentId)

      const attendance = result.attendance ?? result.data
      const subjects = result.autoMarkedSubjects ?? result.newlyMarkedSubjects ?? []
      const enrolledSubjects =
        result.enrolledSubjects ?? result.enrolled_subjects ?? []
      const autoMarkedDetails = (result.autoMarkedDetails ?? []).map(
        (item) => item.label || `${item.subjectName ?? item.subject_name} - Present`,
      )
      const status =
        subjects.length > 0
          ? `Present · ${subjects.join(", ")}`
          : attendance?.status || result.status || "Present"
      const alreadyToday =
        /already marked/i.test(result.message || "") &&
        !(result.newlyMarkedSubjects && result.newlyMarkedSubjects.length > 0)

      const displayName = result.studentName || name
      const displayReg = result.registrationNo || registrationNo

      if (!alreadyToday) {
        playSuccessChime()
        setRecognized({
          studentId,
          name: displayName,
          registrationNo: displayReg,
          status,
          distance,
          enrolledSubjects,
          autoMarkedDetails:
            autoMarkedDetails.length > 0
              ? autoMarkedDetails
              : subjects.map((subject) => `${subject} - Present`),
        })
        if (subjects.length > 0) {
          toast.success(`Auto-marked: ${subjects.join(", ")}`)
        }
        setLog((prev) => {
          if (prev.some((entry) => entry.studentId === studentId)) {
            return prev
          }
          return [
            {
              id: String(studentId),
              studentId,
              name: displayName,
              registrationNo: displayReg,
              status,
              timeLabel: formatClock(new Date()),
              distance,
              enrolledSubjects,
              autoMarkedDetails:
                autoMarkedDetails.length > 0
                  ? autoMarkedDetails
                  : subjects.map((subject) => `${subject} - Present`),
            },
            ...prev,
          ].slice(0, 40)
        })
      } else {
        // Backend says already marked today — track in session, skip list duplicate.
        setRecognized({
          studentId,
          name: displayName,
          registrationNo: displayReg,
          status:
            subjects.length > 0
              ? `Already Marked · ${subjects.join(", ")}`
              : "Already Marked Today",
          distance,
          enrolledSubjects,
          autoMarkedDetails:
            autoMarkedDetails.length > 0
              ? autoMarkedDetails
              : subjects.map((subject) => `${subject} - Present`),
        })
      }
    } catch (error) {
      if (isAlreadyScannedError(error)) {
        markedStudentIdsRef.current.add(studentId)
        setRecognized({
          studentId,
          name,
          registrationNo,
          status: "Already Marked Today",
          distance,
          enrolledSubjects: [],
          autoMarkedDetails: [],
        })
      } else {
        recentDetectionsRef.current.delete(studentId)
        toast.error(getApiErrorMessage(error, `Failed to mark ${name}`))
      }
    } finally {
      markingRef.current = false
    }
  }, [])

  // Continuous detection loop (~300ms).
  useEffect(() => {
    if (!cameraActive || !scanning || !modelsReady || !matcherReady) {
      if (canvasRef.current) clearFaceOverlay(canvasRef.current)
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
            const alreadyMarked = markedStudentIdsRef.current.has(match.studentId)
            overlays.push({
              box: detection.box,
              label: alreadyMarked ? "Already Marked Today" : match.label,
              matched: !alreadyMarked,
              alreadyMarked,
            })
            if (!alreadyMarked && (!bestMatch || match.distance < bestMatch.distance)) {
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

        if (markedStudentIdsRef.current.has(bestMatch.studentId)) {
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
  }, [cameraActive, scanning, modelsReady, matcherReady, recordMatch])

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
        {recognized && (
          <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center px-4">
            <div className="flex w-full max-w-lg flex-col gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-950/90 px-5 py-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-xl font-bold text-emerald-950">
                  {initials(recognized.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-white">
                    {recognized.name}
                  </p>
                  <p className="truncate text-sm text-emerald-200/80">
                    ID: {recognized.registrationNo}
                  </p>
                </div>
                <Badge className="shrink-0 gap-1 border-0 bg-emerald-400 text-emerald-950">
                  <CheckCircle2 className="size-3.5" />
                  {recognized.status}
                </Badge>
              </div>

              {recognized.enrolledSubjects.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium tracking-wide text-emerald-200/70 uppercase">
                    Enrolled Subjects
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {recognized.enrolledSubjects.map((subject) => (
                      <Badge
                        key={subject}
                        className="border-0 bg-sky-400/20 text-sky-100"
                      >
                        {subject}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {recognized.autoMarkedDetails.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium tracking-wide text-emerald-200/70 uppercase">
                    Auto-Marked Subjects Today
                  </p>
                  <ul className="space-y-1 text-sm text-emerald-50">
                    {recognized.autoMarkedDetails.map((detail) => (
                      <li key={detail} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />
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
            Unique students this session · {log.length} marked
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
                    {entry.autoMarkedDetails.length > 0 && (
                      <p className="text-muted-foreground text-[11px]">
                        {entry.autoMarkedDetails.join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge
                      variant={entry.status === "Already marked" ? "secondary" : "default"}
                      className="text-[10px]"
                    >
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
