"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Camera, CheckCircle2, Loader2, ScanFace, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  detectFaceWithBox,
  getCameraErrorMessage,
  loadFaceModels,
  startFaceCamera,
  stopFaceCamera,
  type FaceBox,
} from "@/lib/face-recognition"
import { getApiErrorMessage } from "@/lib/api-errors"
import { listStudents } from "@/services/student"
import { saveStudentFace } from "@/services/student-face"
import type { Student } from "@/types"

const outlineBtn = "border-[#A2D4ED] text-[#0047AB] hover:bg-[#ABD2F2]/40"
const primaryBtn =
  "gap-2 bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white"

export function StudentFaceRegistration() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string>("")

  const [modelsReady, setModelsReady] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(true)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const [faceBox, setFaceBox] = useState<FaceBox | null>(null)
  const [overlayStyle, setOverlayStyle] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const [liveDescriptor, setLiveDescriptor] = useState<number[] | null>(null)
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null)
  const [saving, setSaving] = useState(false)

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter((student) => {
      const name = student.full_name?.toLowerCase() ?? ""
      const id = student.registration_no.toLowerCase()
      return name.includes(q) || id.includes(q) || String(student.id).includes(q)
    })
  }, [search, students])

  const selectedStudent = students.find((s) => String(s.id) === selectedId) ?? null

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        setLoadingStudents(true)
        const items = await listStudents()
        if (!cancelled) setStudents(items)
      } catch {
        if (!cancelled) toast.error("Failed to load students")
      } finally {
        if (!cancelled) setLoadingStudents(false)
      }

      try {
        setModelsLoading(true)
        await loadFaceModels()
        if (!cancelled) setModelsReady(true)
      } catch {
        if (!cancelled) toast.error("Failed to load face recognition models")
      } finally {
        if (!cancelled) setModelsLoading(false)
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
      if (videoRef.current) stopFaceCamera(videoRef.current)
    }
  }, [])

  // Live detection loop for the green face box.
  useEffect(() => {
    if (!cameraActive || !modelsReady) {
      setFaceBox(null)
      setOverlayStyle(null)
      setLiveDescriptor(null)
      return
    }

    let cancelled = false
    const interval = window.setInterval(async () => {
      const video = videoRef.current
      if (!video || cancelled) return
      try {
        const result = await detectFaceWithBox(video)
        if (cancelled) return
        if (!result) {
          setFaceBox(null)
          setOverlayStyle(null)
          setLiveDescriptor(null)
          return
        }
        setFaceBox(result.box)
        setOverlayStyle(
          videoRef.current && frameRef.current
            ? mapBoxToOverlay(result.box, videoRef.current, frameRef.current)
            : null,
        )
        setLiveDescriptor(result.descriptor)
      } catch {
        // Ignore transient frame errors.
      }
    }, 350)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [cameraActive, modelsReady])

  const stopCamera = useCallback(() => {
    if (videoRef.current) stopFaceCamera(videoRef.current)
    setCameraActive(false)
    setFaceBox(null)
    setOverlayStyle(null)
    setLiveDescriptor(null)
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

    setCameraStarting(true)
    try {
      if (!modelsReady) {
        await loadFaceModels()
        setModelsReady(true)
      }
      await startFaceCamera(videoRef.current)
      setCameraActive(true)
      setCapturedDescriptor(null)
    } catch (error) {
      stopCamera()
      const message = getCameraErrorMessage(error)
      setCameraError(message)
      toast.error(message)
    } finally {
      setCameraStarting(false)
    }
  }

  async function handleCaptureFace() {
    if (!selectedId) {
      toast.error("Select a student first")
      return
    }
    if (!cameraActive || !videoRef.current) {
      toast.error("Enable the camera first")
      return
    }

    try {
      const result = await detectFaceWithBox(videoRef.current)
      if (!result || result.descriptor.length !== 128) {
        toast.error("No valid face detected. Look straight at the camera and try again.")
        setCapturedDescriptor(null)
        return
      }
      setCapturedDescriptor(result.descriptor)
      setFaceBox(result.box)
      setOverlayStyle(
        frameRef.current
          ? mapBoxToOverlay(result.box, videoRef.current, frameRef.current)
          : null,
      )
      setLiveDescriptor(result.descriptor)
      toast.success("Face captured — review and click Save Face Data")
    } catch {
      toast.error("Face capture failed")
    }
  }

  async function handleSaveFace() {
    if (!selectedId) {
      toast.error("Select a student first")
      return
    }
    const descriptor = capturedDescriptor ?? liveDescriptor
    if (!descriptor || descriptor.length !== 128) {
      toast.error("Capture a face first")
      return
    }

    setSaving(true)
    try {
      await saveStudentFace(Number(selectedId), descriptor)
      toast.success(
        `Face data saved for ${selectedStudent?.full_name || selectedStudent?.registration_no || "student"}`,
      )
      setCapturedDescriptor(null)
      // Refresh list so has_face_descriptor updates.
      const items = await listStudents()
      setStudents(items)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save face data"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-[#A2D4ED]/60 shadow-[0_12px_40px_rgba(5,8,46,0.05)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#05082E]">
          <ScanFace className="size-5" />
          Student Face Registration
        </CardTitle>
        <CardDescription className="text-[#0047AB]/75">
          Select a student, capture their face from the webcam, and save the 128-element face
          descriptor for recognition attendance.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="face-student-search">Find student</Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                id="face-student-search"
                className="pl-9"
                placeholder="Search by name or student ID..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Student</Label>
            {loadingStudents ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Loading students...
              </p>
            ) : filteredStudents.length === 0 ? (
              <p className="text-muted-foreground text-sm">No students match your search.</p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
                {filteredStudents.map((student) => {
                  const active = String(student.id) === selectedId
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(String(student.id))
                        setCapturedDescriptor(null)
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                    >
                      <span className="font-medium">{student.full_name || "Unnamed"}</span>
                      <span className={`font-mono text-xs ${active ? "opacity-90" : "text-muted-foreground"}`}>
                        {student.registration_no}
                        {student.has_face_descriptor ? " · enrolled" : ""}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {selectedStudent && (
            <div className="rounded-lg border px-3 py-2 text-sm">
              <p className="font-medium">{selectedStudent.full_name}</p>
              <p className="text-muted-foreground">
                ID: {selectedStudent.registration_no}
                {selectedStudent.grade ? ` · Grade ${selectedStudent.grade}` : ""}
                {selectedStudent.has_face_descriptor ? " · Face already registered (re-enroll OK)" : ""}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className={outlineBtn}
              disabled={modelsLoading || cameraStarting}
              onClick={() => void handleEnableCamera()}
            >
              <Camera className="size-4" />
              {cameraStarting
                ? "Starting camera..."
                : cameraActive
                  ? "Restart Camera"
                  : modelsLoading
                    ? "Loading models..."
                    : "Enable Camera"}
            </Button>
            <Button
              type="button"
              className={primaryBtn}
              disabled={!cameraActive || !selectedId}
              onClick={() => void handleCaptureFace()}
            >
              Capture Face 📸
            </Button>
            <Button
              type="button"
              className={primaryBtn}
              disabled={
                saving ||
                !selectedId ||
                !(capturedDescriptor || liveDescriptor)
              }
              onClick={() => void handleSaveFace()}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Save Face Data
                </>
              )}
            </Button>
          </div>

          {(modelsLoading || capturedDescriptor) && (
            <p className="text-muted-foreground text-xs">
              {modelsLoading
                ? "Loading ssdMobilenetv1, faceLandmark68Net, and faceRecognitionNet..."
                : capturedDescriptor
                  ? `Captured descriptor ready (${capturedDescriptor.length} values).`
                  : null}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div
            ref={frameRef}
            className="relative min-h-[280px] overflow-hidden rounded-lg border border-[#A2D4ED]/50 bg-black"
          >
            <video
              ref={videoRef}
              className="min-h-[280px] w-full object-cover"
              muted
              playsInline
            />

            {overlayStyle && (
              <div
                className="pointer-events-none absolute rounded-md border-2 border-[#A2D4ED] shadow-[0_0_0_1px_rgba(162,212,237,0.5)]"
                style={overlayStyle}
              >
                <span className="absolute -top-6 left-0 rounded bg-[#0047AB] px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Face detected
                </span>
              </div>
            )}

            {!cameraActive && (
              <div className="absolute inset-0 flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/80">
                <p>
                  {modelsLoading
                    ? "Loading face recognition models..."
                    : "Enable the camera to preview and capture a face."}
                </p>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="space-y-2">
              <p className="text-destructive text-sm">{cameraError}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void handleEnableCamera()}>
                Try Again
              </Button>
            </div>
          )}

          <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full bg-[#0047AB]" />
              Green box = valid face detected
            </span>
            <span>
              Status:{" "}
              {faceBox
                ? "Face locked"
                : cameraActive
                  ? "Looking for a face..."
                  : "Camera idle"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** Map detection coords (video intrinsic pixels) onto the displayed video box. */
function mapBoxToOverlay(
  box: FaceBox,
  video: HTMLVideoElement,
  frame: HTMLDivElement,
): { left: number; top: number; width: number; height: number } | null {
  const videoWidth = video.videoWidth
  const videoHeight = video.videoHeight
  if (!videoWidth || !videoHeight) return null

  const frameWidth = frame.clientWidth
  const frameHeight = frame.clientHeight
  if (!frameWidth || !frameHeight) return null

  // object-cover scaling
  const scale = Math.max(frameWidth / videoWidth, frameHeight / videoHeight)
  const displayedWidth = videoWidth * scale
  const displayedHeight = videoHeight * scale
  const offsetX = (frameWidth - displayedWidth) / 2
  const offsetY = (frameHeight - displayedHeight) / 2

  return {
    left: offsetX + box.x * scale,
    top: offsetY + box.y * scale,
    width: box.width * scale,
    height: box.height * scale,
  }
}
