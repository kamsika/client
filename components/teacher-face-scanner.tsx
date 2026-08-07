"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, Loader2, ScanFace, VideoOff } from "lucide-react"
import { toast } from "sonner"

import { FaceRecognitionSettingsPanel } from "@/components/face/FaceRecognitionSettings"
import { ScannerAttendancePanel } from "@/components/scanner-attendance-panel"
import { Button } from "@/components/ui/button"
import { getApiErrorMessage } from "@/lib/api-errors"
import {
  clearFaceOverlay,
  createFaceMatcher,
  detectFacesWithBoxes,
  drawFaceOverlays,
  getCameraErrorMessage,
  loadFaceModels,
  matchWithFaceMatcher,
  startFaceCamera,
  stopFaceCamera,
  type FaceMatcherInstance,
} from "@/lib/face-recognition"
import {
  DEFAULT_FACE_SETTINGS,
  type FaceRecognitionSettings,
} from "@/lib/face-settings"
import { cn } from "@/lib/utils"
import { lookupStudentByScannedId } from "@/services/student"
import { listFaceProfiles, type StudentFaceProfile } from "@/services/student-face"
import type { Student } from "@/types"

const DETECT_INTERVAL_MS = 350
const RESCAN_COOLDOWN_MS = 12_000

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

type ProfileMeta = {
  label: string
  registrationNo: string
  grade?: string | null
}

type PreviewState = {
  scannedId: string
  student: Student
  marked: boolean
}

type RecentScan = {
  id: string
  studentName: string
  studentId: string
  status: string
  at: number
}

/**
 * Teacher Face Scanner — identifies a student via face recognition, then
 * continues through the SAME attendance workflow as QR (subject selection →
 * processAttendance → /api/attendance/scan). Does not mark attendance itself.
 */
export function TeacherFaceScanner() {
  const [settings, setSettings] = useState<FaceRecognitionSettings>(DEFAULT_FACE_SETTINGS)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const matcherRef = useRef<FaceMatcherInstance | null>(null)
  const profilesByIdRef = useRef<Map<number, ProfileMeta>>(new Map())
  const enrolledProfilesRef = useRef<StudentFaceProfile[]>([])
  const recentIdsRef = useRef<Map<string, number>>(new Map())
  const inFlightRef = useRef<Set<string>>(new Set())
  const lookingUpRef = useRef(false)
  const previewRef = useRef<PreviewState | null>(null)
  const markingRef = useRef(false)
  const thresholdRef = useRef(settings.recognitionThreshold)

  const [cameraActive, setCameraActive] = useState(false)
  const [modelsReady, setModelsReady] = useState(false)
  const [matcherReady, setMatcherReady] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)
  const [scanStatus, setScanStatus] = useState("Start camera to begin face recognition")
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [markingAttendance, setMarkingAttendance] = useState(false)
  const [recentScans, setRecentScans] = useState<RecentScan[]>([])
  const [unknownFlash, setUnknownFlash] = useState(false)

  previewRef.current = preview
  markingRef.current = markingAttendance
  thresholdRef.current = settings.recognitionThreshold

  const stopCamera = useCallback(() => {
    if (videoRef.current) {
      stopFaceCamera(videoRef.current)
    }
    if (canvasRef.current) {
      clearFaceOverlay(canvasRef.current)
    }
    setCameraActive(false)
  }, [])

  const rebuildMatcher = useCallback(async (items: StudentFaceProfile[], threshold: number) => {
    const enrolled = items.filter((p) => p.descriptor && p.descriptor.length === 128)
    enrolledProfilesRef.current = enrolled
    const byId = new Map(
      enrolled.map((p) => [
        p.id,
        {
          label: p.full_name || p.registration_no,
          registrationNo: p.registration_no,
          grade: p.grade ?? null,
        },
      ]),
    )
    profilesByIdRef.current = byId

    const matcher = await createFaceMatcher(
      enrolled.map((p) => ({ id: p.id, descriptor: p.descriptor as number[] })),
      threshold,
    )
    matcherRef.current = matcher
    setMatcherReady(Boolean(matcher))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadFaceModels()
        if (cancelled) return
        setModelsReady(true)
        const profiles = await listFaceProfiles()
        if (cancelled) return
        await rebuildMatcher(profiles, thresholdRef.current)
        setBootError(null)
        const count = enrolledProfilesRef.current.length
        setScanStatus(
          count === 0
            ? "No registered faces. Register student faces first."
            : "Camera ready — look at the camera to identify a student",
        )
      } catch (error) {
        if (cancelled) return
        const message = getCameraErrorMessage(error) || "Unable to load face models"
        setBootError(message)
        setScanStatus(message)
      }
    })()
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [rebuildMatcher, stopCamera])

  useEffect(() => {
    if (!modelsReady || enrolledProfilesRef.current.length === 0) return
    void rebuildMatcher(enrolledProfilesRef.current, settings.recognitionThreshold)
  }, [modelsReady, settings.recognitionThreshold, rebuildMatcher])

  async function startCamera() {
    setBootError(null)
    if (!videoRef.current) return
    try {
      await startFaceCamera(videoRef.current, settings.cameraDeviceId || undefined)
      setCameraActive(true)
      setScanStatus("Point the camera at the student — recognition only identifies them")
    } catch (error) {
      const message = getCameraErrorMessage(error)
      setBootError(message)
      setScanStatus(message)
      toast.error(message)
    }
  }

  const identifyStudent = useCallback(
    async (studentId: number, registrationNo: string | undefined, _distance: number) => {
      const scannedId = (registrationNo || String(studentId)).trim()
      if (!scannedId) return
      if (lookingUpRef.current || markingRef.current) return
      if (previewRef.current && !previewRef.current.marked) return

      const last = recentIdsRef.current.get(scannedId)
      const now = Date.now()
      if (typeof last === "number" && now - last < RESCAN_COOLDOWN_MS) return
      if (inFlightRef.current.has(scannedId)) return

      lookingUpRef.current = true
      inFlightRef.current.add(scannedId)
      setUnknownFlash(false)
      setScanStatus("Student recognized — loading details…")

      try {
        const student = await lookupStudentByScannedId(scannedId)
        recentIdsRef.current.set(scannedId, Date.now())
        setPreview({ scannedId, student, marked: false })
        setScanStatus(
          `Student found: ${student.full_name || scannedId} — select subject(s) to mark attendance`,
        )
      } catch (error) {
        const message = getApiErrorMessage(error, "Student not found")
        setScanStatus(message)
        toast.error(message)
      } finally {
        lookingUpRef.current = false
        inFlightRef.current.delete(scannedId)
      }
    },
    [],
  )

  useEffect(() => {
    if (!cameraActive || !modelsReady || !matcherReady) return
    let cancelled = false
    let detecting = false

    const interval = window.setInterval(async () => {
      if (cancelled || detecting) return
      const video = videoRef.current
      const canvas = canvasRef.current
      const matcher = matcherRef.current
      if (!video || !canvas || !matcher || video.readyState < 2) return
      if (lookingUpRef.current || markingRef.current) return
      if (previewRef.current && !previewRef.current.marked) return

      detecting = true
      try {
        const detections = await detectFacesWithBoxes(video)
        if (cancelled) return

        if (detections.length === 0) {
          clearFaceOverlay(canvas as HTMLCanvasElement)
          return
        }

        if (detections.length > 1) {
          drawFaceOverlays(
            canvas,
            video,
            detections.map((d) => ({
              box: d.box,
              label: "Multiple faces",
              severity: "multi" as const,
            })),
          )
          setScanStatus("Multiple faces detected — one student only")
          return
        }

        const detection = detections[0]
        const match = matchWithFaceMatcher(
          matcher,
          detection.descriptor,
          profilesByIdRef.current,
        )

        if (!match) {
          drawFaceOverlays(canvas, video, [
            {
              box: detection.box,
              label: "Unknown Student",
              severity: "unknown",
            },
          ])
          setUnknownFlash(true)
          setScanStatus("Unknown Student")
          return
        }

        drawFaceOverlays(canvas, video, [
          {
            box: detection.box,
            label: match.label,
            matched: true,
            severity: "matched",
          },
        ])
        setUnknownFlash(false)

        const profile = profilesByIdRef.current.get(match.studentId)
        void identifyStudent(match.studentId, profile?.registrationNo, match.distance)
      } catch {
        // ignore frame errors
      } finally {
        detecting = false
      }
    }, DETECT_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [cameraActive, modelsReady, matcherReady, identifyStudent])

  function dismissPreview() {
    setPreview(null)
    setScanStatus("Camera ready — look at the camera to identify a student")
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className={cn(cardShell, "overflow-hidden p-4")}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-[#05082E]">Face Recognition</h2>
              <p className="text-sm text-[#0047AB]/75">
                Identifies the student, then uses the same attendance flow as QR.
              </p>
            </div>
            <div className="flex gap-2">
              {!cameraActive ? (
                <Button
                  type="button"
                  onClick={() => void startCamera()}
                  disabled={!modelsReady}
                  className="gap-2 bg-[#F9BF15] font-semibold text-[#05082E] hover:bg-[#E88D1D] hover:text-white"
                >
                  {modelsReady ? (
                    <>
                      <Camera className="size-4" />
                      Start camera
                    </>
                  ) : (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Loading models…
                    </>
                  )}
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={stopCamera} className="gap-2">
                  <VideoOff className="size-4" />
                  Stop camera
                </Button>
              )}
            </div>
          </div>

          <div className="relative aspect-video overflow-hidden rounded-xl bg-[#05082E]">
            <video
              ref={videoRef}
              className="absolute inset-0 size-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
                <ScanFace className="size-10 opacity-60" />
                <p className="text-sm">Camera off</p>
              </div>
            )}
            {unknownFlash && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-red-600/90 px-4 py-1.5 text-sm font-semibold text-white">
                Unknown Student
              </div>
            )}
          </div>

          <p
            className={cn(
              "mt-3 text-sm",
              unknownFlash ? "font-medium text-red-600" : "text-[#0047AB]/80",
            )}
          >
            {scanStatus}
          </p>
          {bootError && <p className="mt-1 text-sm text-red-600">{bootError}</p>}
        </div>

        {preview && (
          <ScannerAttendancePanel
            scannedId={preview.scannedId}
            student={preview.student}
            attendanceMethod="FACE"
            marked={preview.marked}
            onMarkedChange={(next) =>
              setPreview((current) => (current ? { ...current, marked: next } : current))
            }
            onMarkingChange={setMarkingAttendance}
            onStatus={setScanStatus}
            idleStatusMessage="Camera ready — look at the camera to identify a student"
            onDismiss={dismissPreview}
            onComplete={(payload) => {
              recentIdsRef.current.set(payload.scannedId, Date.now())
              setRecentScans((current) =>
                [
                  {
                    id: `${payload.scannedId}-${Date.now()}`,
                    studentName: payload.studentName,
                    studentId: payload.registrationNo,
                    status: payload.isAlready ? "Already marked" : "Present",
                    at: Date.now(),
                  },
                  ...current,
                ].slice(0, 8),
              )
            }}
          />
        )}

        {recentScans.length > 0 && (
          <div className={cn(cardShell, "p-4")}>
            <h3 className="text-sm font-semibold text-[#05082E]">Recent (Face)</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-[#0047AB]/85">
              {recentScans.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span>
                    {item.studentName} · {item.studentId}
                  </span>
                  <span className="shrink-0 font-medium">{item.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <FaceRecognitionSettingsPanel onChange={setSettings} />
    </div>
  )
}
