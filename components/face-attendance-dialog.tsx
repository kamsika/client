"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, ScanFace, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  detectFaceDescriptor,
  getCameraErrorMessage,
  loadFaceModels,
  matchFaceDescriptor,
  startFaceCamera,
  stopFaceCamera,
} from "@/lib/face-recognition"
import { markAttendance } from "@/services/attendance"
import { listFaceProfiles, saveStudentFace, type StudentFaceProfile } from "@/services/student-face"

interface FaceAttendanceDialogProps {
  classroomId: number
  classroomName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FaceMode = "mark" | "enroll"

export function FaceAttendanceDialog({
  classroomId,
  classroomName,
  open,
  onOpenChange,
}: FaceAttendanceDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const markingRef = useRef(false)
  const recentMarksRef = useRef<Map<number, number>>(new Map())

  const [mode, setMode] = useState<FaceMode>("mark")
  const [profiles, setProfiles] = useState<StudentFaceProfile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [modelsReady, setModelsReady] = useState(false)
  const [lastMatch, setLastMatch] = useState<string | null>(null)
  const [enrollStudentId, setEnrollStudentId] = useState<string>("")
  const [enrolling, setEnrolling] = useState(false)

  const enrolledProfiles = profiles.filter(
    (profile) => profile.descriptor && profile.descriptor.length > 0,
  )

  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true)
    try {
      const data = await listFaceProfiles()
      setProfiles(data)
    } catch {
      toast.error("Failed to load student face profiles")
    } finally {
      setLoadingProfiles(false)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (videoRef.current) {
      stopFaceCamera(videoRef.current)
    }
    setCameraActive(false)
  }, [])

  useEffect(() => {
    if (!open) {
      stopCamera()
      setMode("mark")
      setCameraError(null)
      setLastMatch(null)
      setEnrollStudentId("")
      recentMarksRef.current.clear()
      return
    }

    loadProfiles()
    loadFaceModels()
      .then(() => setModelsReady(true))
      .catch(() => toast.error("Failed to load face recognition models"))
  }, [open, loadProfiles, stopCamera])

  async function handleEnableCamera() {
    setCameraError(null)

    if (typeof window !== "undefined" && !window.isSecureContext) {
      const message = getCameraErrorMessage(new Error("secure context"))
      setCameraError(message)
      toast.error(message)
      return
    }

    if (!videoRef.current) {
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
    } catch (error) {
      stopCamera()
      const message = getCameraErrorMessage(error)
      setCameraError(message)
      toast.error(message)
    } finally {
      setCameraStarting(false)
    }
  }

  const handleMarkMatch = useCallback(
    async (studentId: number, label: string) => {
      const now = Date.now()
      const lastMarkedAt = recentMarksRef.current.get(studentId)
      if (lastMarkedAt && now - lastMarkedAt < 4000) {
        return
      }

      markingRef.current = true
      try {
        const result = await markAttendance(studentId, classroomId)
        recentMarksRef.current.set(studentId, now)
        setLastMatch(label)
        toast.success(
          result.attendance.status === "Late"
            ? `${label} marked late (${result.delta_minutes} min) — parent SMS triggered`
            : result.attendance.status === "Absent"
              ? `${label} marked absent — parent SMS triggered`
              : `${label} marked ${result.attendance.status}`,
        )
      } catch {
        toast.error(`Failed to mark attendance for ${label}`)
      } finally {
        markingRef.current = false
      }
    },
    [classroomId],
  )

  useEffect(() => {
    if (!open || !cameraActive || mode !== "mark") {
      return
    }

    const interval = window.setInterval(async () => {
      const video = videoRef.current
      if (!video || markingRef.current) {
        return
      }

      const enrolled = profiles.filter(
        (profile) => profile.descriptor && profile.descriptor.length > 0,
      )
      if (enrolled.length === 0) {
        return
      }

      try {
        const descriptor = await detectFaceDescriptor(video)
        if (!descriptor) {
          return
        }

        const match = matchFaceDescriptor(
          descriptor,
          enrolled.map((profile) => ({
            id: profile.id,
            label: profile.full_name || profile.registration_no,
            descriptor: profile.descriptor as number[],
          })),
        )

        if (match) {
          await handleMarkMatch(match.studentId, match.label)
        }
      } catch {
        // Ignore transient detection errors between frames.
      }
    }, 900)

    return () => window.clearInterval(interval)
  }, [open, cameraActive, mode, profiles, handleMarkMatch])

  async function handleEnrollFace() {
    if (!enrollStudentId) {
      toast.error("Select a student to enroll")
      return
    }

    const video = videoRef.current
    if (!video || !cameraActive) {
      toast.error("Enable the camera first")
      return
    }

    setEnrolling(true)
    try {
      const descriptor = await detectFaceDescriptor(video)
      if (!descriptor) {
        toast.error("No face detected. Ask the student to look at the camera.")
        return
      }

      await saveStudentFace(Number(enrollStudentId), descriptor)
      toast.success("Face profile saved")
      await loadProfiles()
    } catch {
      toast.error("Failed to save face profile")
    } finally {
      setEnrolling(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="size-4" />
            Face Recognition Attendance
          </DialogTitle>
          <DialogDescription>
            Mark attendance for {classroomName} using face recognition. Enroll student faces first,
            then scan to mark present.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "mark" ? "default" : "outline"}
            onClick={() => setMode("mark")}
          >
            Mark Attendance
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "enroll" ? "default" : "outline"}
            onClick={() => setMode("enroll")}
          >
            <UserPlus className="size-4" />
            Enroll Face
          </Button>
        </div>

        <div className="space-y-3">
          <div className="relative min-h-[280px] overflow-hidden rounded-lg border bg-black">
            <video
              ref={videoRef}
              className="min-h-[280px] w-full object-cover"
              muted
              playsInline
            />

            {!cameraActive && (
              <div className="absolute inset-0 flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/80">
                <p>
                  {loadingProfiles
                    ? "Loading student profiles..."
                    : !modelsReady
                      ? "Loading face recognition models..."
                      : "Allow camera access to use face recognition."}
                </p>
                <Button
                  type="button"
                  onClick={() => void handleEnableCamera()}
                  disabled={loadingProfiles || cameraStarting || !modelsReady}
                >
                  <Camera className="size-4" />
                  {cameraStarting ? "Starting camera..." : "Allow Camera Access"}
                </Button>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="space-y-2 text-center">
              <p className="text-destructive text-sm">{cameraError}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void handleEnableCamera()}>
                Try Again
              </Button>
            </div>
          )}

          {mode === "mark" ? (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Enrolled faces: {enrolledProfiles.length} / {profiles.length}
              </p>
              {enrolledProfiles.length === 0 && (
                <p className="text-amber-600">
                  No enrolled faces yet. Switch to Enroll Face and register students first.
                </p>
              )}
              {lastMatch && (
                <p>
                  Last recognized: <span className="font-medium">{lastMatch}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Select value={enrollStudentId} onValueChange={(value) => value && setEnrollStudentId(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student to enroll" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={String(profile.id)}>
                      {profile.full_name || profile.registration_no}
                      {profile.has_face_descriptor ? " (re-enroll)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                className="w-full"
                disabled={!cameraActive || enrolling || !enrollStudentId}
                onClick={() => void handleEnrollFace()}
              >
                {enrolling ? "Saving face..." : "Capture & Save Face"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
