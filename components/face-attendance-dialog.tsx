"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, ScanFace, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { AttendanceSubjectSelectionDialog } from "@/components/attendance-subject-selection-dialog"
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
  detectFacesWithBoxes,
  getCameraErrorMessage,
  loadFaceModels,
  matchFaceDescriptor,
  startFaceCamera,
  stopFaceCamera,
} from "@/lib/face-recognition"
import { getApiErrorMessage, isAlreadyScannedError } from "@/lib/api-errors"
import { selectItems } from "@/lib/select-items"
import { markKioskAttendance, type AttendanceSubjectOption } from "@/services/attendance"
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
  const recognitionPausedUntilRef = useRef(0)

  const [mode, setMode] = useState<FaceMode>("mark")
  const [profiles, setProfiles] = useState<StudentFaceProfile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [modelsReady, setModelsReady] = useState(false)
  const [lastMatch, setLastMatch] = useState<string | null>(null)
  const [detectionHint, setDetectionHint] = useState<string | null>(null)
  const [detectedFaceCount, setDetectedFaceCount] = useState(0)
  const [enrollStudentId, setEnrollStudentId] = useState<string>("")
  const [enrolling, setEnrolling] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<{
    studentId: number
    studentName: string
    options: AttendanceSubjectOption[]
    paymentStatus?: "Pending" | "Paid" | "Overdue"
  } | null>(null)

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

  const stopCameraTracks = useCallback(() => {
    if (videoRef.current) {
      stopFaceCamera(videoRef.current)
    }
  }, [])

  const resetDialogState = useCallback(() => {
    stopCameraTracks()
    setCameraActive(false)
    setMode("mark")
    setCameraError(null)
    setLastMatch(null)
    setEnrollStudentId("")
    setPendingSelection(null)
    recentMarksRef.current.clear()
    recognitionPausedUntilRef.current = 0
  }, [stopCameraTracks])

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    async function initializeDialog() {
      try {
        setLoadingProfiles(true)
        const data = await listFaceProfiles()
        if (!cancelled) {
          setProfiles(data)
        }
      } catch {
        if (!cancelled) {
          toast.error("Failed to load student face profiles")
        }
      } finally {
        if (!cancelled) {
          setLoadingProfiles(false)
        }
      }

      try {
        await loadFaceModels()
        if (!cancelled) {
          setModelsReady(true)
        }
      } catch {
        if (!cancelled) {
          toast.error("Failed to load face recognition models")
        }
      }
    }

    void initializeDialog()

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    const video = videoRef.current
    return () => {
      if (video) {
        stopFaceCamera(video)
      }
    }
  }, [])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetDialogState()
    }
    onOpenChange(nextOpen)
  }

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
      stopCameraTracks()
      setCameraActive(false)
      const message = getCameraErrorMessage(error)
      setCameraError(message)
      toast.error(message)
    } finally {
      setCameraStarting(false)
    }
  }

  const handleMarkMatch = useCallback(
    async (studentId: number, label: string) => {
      if (pendingSelection) return
      const now = Date.now()
      const lastMarkedAt = recentMarksRef.current.get(studentId)

      // Returning student already marked this dialog session.
      if (lastMarkedAt && now - lastMarkedAt < 7000) {
        setLastMatch(`${label} · Already marked`)
        setDetectionHint("Already marked")
        toast.message(`${label} is already marked for this class.`)
        return
      }
      if (now < recognitionPausedUntilRef.current && lastMarkedAt) {
        setLastMatch(`${label} · Already marked`)
        setDetectionHint("Already marked")
        toast.message(`${label} is already marked for this class.`)
        return
      }
      if (now < recognitionPausedUntilRef.current) {
        return
      }

      markingRef.current = true
      try {
        const result = await markKioskAttendance({
          studentId,
          classroomId,
          timestamp: new Date().toISOString(),
        })
        recentMarksRef.current.set(studentId, Date.now())
        recognitionPausedUntilRef.current = Date.now() + 7000
        setLastMatch(label)
        const attendanceOptions =
          result.attendanceOptions ?? result.attendance_options ?? []
        const paymentStatus =
          result.paymentStatus ?? result.payment_status ?? result.monthlyPayment?.payment_status
        if (attendanceOptions.length > 1) {
          setPendingSelection({
            studentId,
            studentName: result.studentName || label,
            options: attendanceOptions,
            paymentStatus,
          })
        }
        if (result.status === "NoClass") {
          toast.message(`${label}: no timetable class is active right now.`)
          return
        }
        if (result.status === "AlreadyMarked") {
          setLastMatch(`${label} · Already marked`)
          setDetectionHint("Already marked")
          toast.message(result.message || `${label} is already marked for this class.`)
          return
        }
        const attendance = result.attendance ?? result.data
        if (!attendance) {
          toast.error(result.message || `Attendance was not recorded for ${label}`)
          recentMarksRef.current.delete(studentId)
          recognitionPausedUntilRef.current = 0
          return
        }
        toast.success("Face Updated Successfully")
      } catch (error) {
        if (isAlreadyScannedError(error)) {
          recentMarksRef.current.set(studentId, Date.now())
          setLastMatch(`${label} · Already marked`)
          setDetectionHint("Already marked")
          toast.message(getApiErrorMessage(error, `${label} is already marked for this class.`))
        } else {
          toast.error(getApiErrorMessage(error, `Failed to mark attendance for ${label}`))
        }
      } finally {
        markingRef.current = false
      }
    },
    [classroomId, pendingSelection],
  )

  async function confirmUpcomingClasses(selectedSubjects: string[]) {
    if (!pendingSelection) return
    try {
      const result = await markKioskAttendance({
        studentId: pendingSelection.studentId,
        classroomId,
        timestamp: new Date().toISOString(),
        selectedSubjects,
      })
      const newlyMarked = result.newlyMarkedSubjects ?? []
      if (newlyMarked.length > 0) toast.success("Face Updated Successfully")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to confirm class attendance"))
      throw error
    }
  }

  useEffect(() => {
    if (!open || !cameraActive || mode !== "enroll") {
      return
    }

    const interval = window.setInterval(async () => {
      const video = videoRef.current
      if (!video) return
      try {
        const detections = await detectFacesWithBoxes(video)
        const faceCount = detections.length
        setDetectedFaceCount(faceCount)
        if (faceCount === 0) {
          setDetectionHint("No face detected. Please stand in front of the camera.")
        } else if (faceCount > 1) {
          setDetectionHint(
            "Multiple faces detected. Please ensure only one student is in front of the camera.",
          )
        } else {
          setDetectionHint(null)
        }
      } catch {
        // Ignore transient frame errors.
      }
    }, 500)

    return () => window.clearInterval(interval)
  }, [open, cameraActive, mode])

  useEffect(() => {
    if (!open || !cameraActive || mode !== "mark") {
      return
    }

    const interval = window.setInterval(async () => {
      const video = videoRef.current
      if (!video || markingRef.current) {
        return
      }
      if (Date.now() < recognitionPausedUntilRef.current) {
        return
      }

      const enrolled = profiles.filter(
        (profile) => profile.descriptor && profile.descriptor.length > 0,
      )
      if (enrolled.length === 0) {
        return
      }

      try {
        const detections = await detectFacesWithBoxes(video)
        const faceCount = detections.length
        setDetectedFaceCount(faceCount)

        if (faceCount === 0) {
          setDetectionHint("No face detected. Please stand in front of the camera.")
          return
        }

        if (faceCount > 1) {
          setDetectionHint(
            "Multiple faces detected. Please ensure only one student is in front of the camera.",
          )
          return
        }

        setDetectionHint(null)
        const descriptor = detections[0]?.descriptor
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
        } else {
          setDetectionHint("Face not registered.")
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

    if (detectedFaceCount !== 1) {
      toast.error(
        detectedFaceCount > 1
          ? "Multiple faces detected. Please ensure only one student is in front of the camera."
          : "No face detected. Please stand in front of the camera.",
      )
      return
    }

    setEnrolling(true)
    try {
      const detections = await detectFacesWithBoxes(video)
      if (detections.length !== 1) {
        toast.error(
          detections.length > 1
            ? "Multiple faces detected. Please ensure only one student is in front of the camera."
            : "No face detected. Please stand in front of the camera.",
        )
        return
      }

      await saveStudentFace(Number(enrollStudentId), detections[0].descriptor)
      toast.success("Face profile saved")
      await loadProfiles()
    } catch {
      toast.error("Failed to save face profile")
    } finally {
      setEnrolling(false)
    }
  }

  return (
    <>
      <AttendanceSubjectSelectionDialog
        open={Boolean(pendingSelection)}
        studentName={pendingSelection?.studentName ?? "Student"}
        options={pendingSelection?.options ?? []}
        paymentStatus={pendingSelection?.paymentStatus}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingSelection(null)
        }}
        onConfirm={confirmUpcomingClasses}
      />
      <Dialog open={open} onOpenChange={handleOpenChange}>
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

          {cameraActive && detectionHint && (
            <p
              className={`rounded-lg border px-3 py-2 text-sm whitespace-pre-line ${
                detectedFaceCount > 1
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-[#A2D4ED]/60 bg-[#f8fbfe] text-[#0047AB]"
              }`}
            >
              {detectionHint}
            </p>
          )}

          {mode === "mark" ? (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Enrolled faces: {enrolledProfiles.length} / {profiles.length}
              </p>
              {enrolledProfiles.length === 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-sm text-amber-900">
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
              <Select
                value={enrollStudentId}
                onValueChange={(value) => value && setEnrollStudentId(value)}
                items={selectItems(
                  profiles.map((profile) => ({
                    value: profile.id,
                    label: `${profile.full_name || profile.registration_no}${
                      profile.has_face_descriptor ? " (re-enroll)" : ""
                    }`,
                  })),
                )}
              >
                <SelectTrigger className="w-full min-w-[16rem]">
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
                disabled={!cameraActive || enrolling || !enrollStudentId || detectedFaceCount !== 1}
                onClick={() => void handleEnrollFace()}
              >
                {enrolling ? "Saving face..." : "Capture & Save Face"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
      </Dialog>
    </>
  )
}
