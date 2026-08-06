"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Camera, CheckCircle2, Loader2, ScanFace } from "lucide-react"
import { toast } from "sonner"

import { FaceCamera, type FaceCameraHandle } from "@/components/face/FaceCamera"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getApiErrorMessage } from "@/lib/api-errors"
import {
  averageEmbeddings,
  clearFaceOverlay,
  detectFacesWithBoxes,
  drawFaceOverlays,
  getCameraErrorMessage,
  loadFaceModels,
  startFaceCamera,
  stopFaceCamera,
} from "@/lib/face-recognition"
import { studentInitials } from "@/lib/student-qr-payload"
import {
  registerTeacherStudentFace,
  updateTeacherStudentFace,
} from "@/services/teacher-face"
import type { Student } from "@/types"

const primaryBtn =
  "gap-2 bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white"

const outlineBtn = "border-[#A2D4ED] text-[#0047AB] hover:bg-[#ABD2F2]/40"

const TARGET_SAMPLES = 5
const DETECT_INTERVAL_MS = 350
const MIN_SAMPLE_GAP_MS = 700

type CaptureMode = "register" | "update"

interface TeacherRegisterFaceDialogProps {
  student: Student
  open: boolean
  mode: CaptureMode
  onOpenChange: (open: boolean) => void
  onRegistered?: () => void
}

function enrolledOf(student: Student) {
  return student.enrolledSubjects ?? student.enrolled_subjects ?? []
}

function classroomOf(student: Student) {
  return (
    student.classroomName ||
    student.classroom_name ||
    student.classroom?.name ||
    [student.grade, student.section].filter(Boolean).join(" · ") ||
    "—"
  )
}

function institutionOf(student: Student) {
  return (
    student.institutionName ||
    student.institution_name ||
    student.tuitionCenterName ||
    student.tuition_center_name ||
    "—"
  )
}

export function TeacherRegisterFaceDialog({
  student,
  open,
  mode,
  onOpenChange,
  onRegistered,
}: TeacherRegisterFaceDialogProps) {
  const cameraRef = useRef<FaceCameraHandle>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const samplesRef = useRef<number[][]>([])
  const lastSampleAtRef = useRef(0)
  const capturingRef = useRef(false)

  const [modelsReady, setModelsReady] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [sampleCount, setSampleCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [instruction, setInstruction] = useState("Enable the camera to begin face capture.")
  const [liveFaceCount, setLiveFaceCount] = useState(0)

  const subjects = useMemo(() => enrolledOf(student), [student])

  const reset = useCallback(() => {
    const video = cameraRef.current?.getVideo()
    if (video) stopFaceCamera(video)
    if (canvasRef.current) clearFaceOverlay(canvasRef.current)
    setCameraActive(false)
    setCapturing(false)
    capturingRef.current = false
    setSampleCount(0)
    samplesRef.current = []
    lastSampleAtRef.current = 0
    setCameraError(null)
    setInstruction("Enable the camera to begin face capture.")
    setLiveFaceCount(0)
  }, [])

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    void loadFaceModels()
      .then(() => setModelsReady(true))
      .catch(() => toast.error("Failed to load face recognition models"))
  }, [open, reset])

  async function startCamera() {
    setCameraError(null)
    const video = cameraRef.current?.getVideo()
    if (!video) return
    try {
      if (!modelsReady) {
        await loadFaceModels()
        setModelsReady(true)
      }
      await startFaceCamera(video)
      setCameraActive(true)
      setInstruction("Position one face in frame. Capture starts automatically.")
    } catch (error) {
      setCameraError(getCameraErrorMessage(error))
    }
  }

  // Live detection + automatic multi-angle sample collection.
  useEffect(() => {
    if (!open || !cameraActive || !modelsReady || saving) return

    let cancelled = false

    const timer = window.setInterval(async () => {
      const video = cameraRef.current?.getVideo()
      const canvas = canvasRef.current
      if (!video || !canvas || cancelled) return

      try {
        const detections = await detectFacesWithBoxes(video)
        if (cancelled) return

        setLiveFaceCount(detections.length)

        if (detections.length === 0) {
          clearFaceOverlay(canvas)
          setInstruction("No face detected. Please stand in front of the camera.")
          return
        }

        if (detections.length > 1) {
          drawFaceOverlays(
            canvas,
            video,
            detections.map((detection) => ({
              box: detection.box,
              label: "Multiple faces",
              severity: "multi" as const,
            })),
          )
          setInstruction(
            "Multiple faces detected.\nPlease ensure only one student is in front of the camera.",
          )
          return
        }

        const detection = detections[0]
        drawFaceOverlays(canvas, video, [
          {
            box: detection.box,
            label: capturingRef.current ? `Sample ${samplesRef.current.length + 1}/${TARGET_SAMPLES}` : "Ready",
            matched: true,
            severity: "valid",
          },
        ])

        if (!capturingRef.current) {
          setInstruction("Face detected. Click Start capture, then slowly turn your head.")
          return
        }

        if (samplesRef.current.length >= TARGET_SAMPLES) return

        const now = Date.now()
        if (now - lastSampleAtRef.current < MIN_SAMPLE_GAP_MS) {
          setInstruction(
            `Hold still… capturing sample ${samplesRef.current.length + 1}/${TARGET_SAMPLES}`,
          )
          return
        }

        if (detection.descriptor?.length === 128) {
          samplesRef.current.push(detection.descriptor)
          lastSampleAtRef.current = now
          const count = samplesRef.current.length
          setSampleCount(count)
          setInstruction(
            count < TARGET_SAMPLES
              ? `Captured ${count}/${TARGET_SAMPLES}. Slightly change your angle.`
              : "All samples captured. Saving…",
          )
        }
      } catch {
        // Ignore transient frame errors.
      }
    }, DETECT_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [open, cameraActive, modelsReady, saving])

  useEffect(() => {
    if (sampleCount < TARGET_SAMPLES || !capturingRef.current || saving) return
    void finalizeCapture()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleCount])

  async function finalizeCapture() {
    if (saving) return
    capturingRef.current = false
    setCapturing(false)

    const averaged = averageEmbeddings(samplesRef.current)
    if (!averaged || samplesRef.current.length < TARGET_SAMPLES) {
      toast.error("Could not capture 5 clear samples. Try again with better lighting.")
      samplesRef.current = []
      setSampleCount(0)
      setInstruction("Capture failed. Click Start capture to try again.")
      return
    }

    setSaving(true)
    try {
      if (mode === "update") {
        await updateTeacherStudentFace(student.id, samplesRef.current, averaged)
        toast.success(`Face updated for ${student.full_name || student.registration_no}`)
      } else {
        await registerTeacherStudentFace(student.id, samplesRef.current, averaged)
        toast.success(`Face registered for ${student.full_name || student.registration_no}`)
      }
      onRegistered?.()
      onOpenChange(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save face data"))
      setInstruction("Save failed. You can restart capture and try again.")
    } finally {
      setSaving(false)
    }
  }

  function beginCapture() {
    if (!cameraActive) {
      toast.error("Start the camera first")
      return
    }
    samplesRef.current = []
    lastSampleAtRef.current = 0
    setSampleCount(0)
    capturingRef.current = true
    setCapturing(true)
    setInstruction("Capturing… keep one face in frame and move slowly.")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#A2D4ED]/40 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#05082E]">
            <ScanFace className="size-5 text-[#0047AB]" />
            {mode === "update" ? "Update Face" : "Register Face"}
          </DialogTitle>
          <DialogDescription className="text-[#0047AB]/75">
            Capture {TARGET_SAMPLES} face samples automatically. Only the embedding is stored — no
            photos are saved.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 rounded-xl border border-[#A2D4ED]/50 bg-[#f8fbfe] p-4 sm:grid-cols-[auto_1fr]">
          <Avatar size="lg" className="size-16">
            <AvatarFallback className="bg-[#A2D4ED]/40 text-[#0047AB]">
              {studentInitials(student.full_name)}
            </AvatarFallback>
          </Avatar>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Student Name</dt>
              <dd className="font-medium text-[#05082E]">{student.full_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Student ID</dt>
              <dd className="font-mono font-medium text-[#05082E]">{student.registration_no}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Grade</dt>
              <dd className="font-medium text-[#05082E]">{student.grade || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Class</dt>
              <dd className="font-medium text-[#05082E]">{classroomOf(student)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Institution</dt>
              <dd className="font-medium text-[#05082E]">{institutionOf(student)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">Subjects</dt>
              <dd className="flex flex-wrap gap-1.5">
                {subjects.length > 0 ? (
                  subjects.map((subject) => (
                    <Badge key={subject} variant="secondary" className="text-xs">
                      {subject}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">No enrolled subjects</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="relative">
          <FaceCamera
            ref={cameraRef}
            active={cameraActive}
            loading={!modelsReady}
            error={cameraError}
            placeholder={<p>Enable the webcam to begin multi-angle capture.</p>}
            overlay={
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            }
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#0047AB]/75">
            <span>Capture progress</span>
            <span className="font-medium tabular-nums">
              {sampleCount}/{TARGET_SAMPLES}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#A2D4ED]/40">
            <div
              className="h-full bg-[#0047AB] transition-all duration-300"
              style={{ width: `${Math.min(100, (sampleCount / TARGET_SAMPLES) * 100)}%` }}
            />
          </div>
          <p className="text-sm text-[#0047AB]/85">{instruction}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className={outlineBtn}
            onClick={() => void startCamera()}
            disabled={capturing || saving}
          >
            <Camera className="size-4" />
            {cameraActive ? "Restart camera" : "Enable camera"}
          </Button>
          <Button
            type="button"
            className={primaryBtn}
            disabled={!cameraActive || capturing || saving || liveFaceCount !== 1}
            onClick={beginCapture}
          >
            {capturing || saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {saving ? "Saving…" : `Capturing ${sampleCount}/${TARGET_SAMPLES}…`}
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                {mode === "update" ? "Start update capture" : "Start capture"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
