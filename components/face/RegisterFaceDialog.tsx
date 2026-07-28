"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, CheckCircle2, Loader2, ScanFace } from "lucide-react"
import { toast } from "sonner"

import { FaceCamera, type FaceCameraHandle } from "@/components/face/FaceCamera"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { averageEmbeddings, detectFaceWithBox, getCameraErrorMessage, loadFaceModels, startFaceCamera, stopFaceCamera } from "@/lib/face-recognition"
import { getApiErrorMessage } from "@/lib/api-errors"
import { registerFaceEmbeddings } from "@/services/student-face"
import type { Student } from "@/types"

const TARGET_SAMPLES = 25
const SAMPLE_INTERVAL_MS = 450

interface RegisterFaceDialogProps {
  student: Student
  open: boolean
  onOpenChange: (open: boolean) => void
  onRegistered?: () => void
}

export function RegisterFaceDialog({
  student,
  open,
  onOpenChange,
  onRegistered,
}: RegisterFaceDialogProps) {
  const cameraRef = useRef<FaceCameraHandle>(null)
  const samplesRef = useRef<number[][]>([])
  const [modelsReady, setModelsReady] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [sampleCount, setSampleCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const reset = useCallback(() => {
    const video = cameraRef.current?.getVideo()
    if (video) stopFaceCamera(video)
    setCameraActive(false)
    setCapturing(false)
    setSampleCount(0)
    samplesRef.current = []
    setCameraError(null)
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
      if (!modelsReady) await loadFaceModels()
      await startFaceCamera(video)
      setCameraActive(true)
    } catch (error) {
      setCameraError(getCameraErrorMessage(error))
    }
  }

  async function captureSamples() {
    const video = cameraRef.current?.getVideo()
    if (!video || !cameraActive) {
      toast.error("Start the camera first")
      return
    }

    setCapturing(true)
    samplesRef.current = []
    setSampleCount(0)

    await new Promise<void>((resolve) => {
      let collected = 0
      const timer = window.setInterval(async () => {
        if (collected >= TARGET_SAMPLES) {
          window.clearInterval(timer)
          resolve()
          return
        }
        try {
          const result = await detectFaceWithBox(video)
          if (result?.descriptor?.length === 128) {
            samplesRef.current.push(result.descriptor)
            collected += 1
            setSampleCount(collected)
          }
        } catch {
          // skip bad frame
        }
      }, SAMPLE_INTERVAL_MS)
    })

    setCapturing(false)

    const averaged = averageEmbeddings(samplesRef.current)
    if (!averaged || samplesRef.current.length < 10) {
      toast.error(
        "Could not capture enough angles. Improve lighting, move your head slowly, and try again.",
      )
      return
    }

    setSaving(true)
    try {
      await registerFaceEmbeddings(student.id, samplesRef.current, averaged)
      toast.success(`Face registered for ${student.full_name || student.registration_no}`)
      onRegistered?.()
      onOpenChange(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save face profile"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-lg border-[#A2D4ED]/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#05082E]">
            <ScanFace className="size-5 text-[#0047AB]" />
            Register Face
          </DialogTitle>
          <DialogDescription>
            Capture {TARGET_SAMPLES} angles for {student.full_name || student.registration_no}. Only
            the averaged embedding is stored — no photos are saved.
          </DialogDescription>
        </DialogHeader>

        <FaceCamera
          ref={cameraRef}
          active={cameraActive}
          loading={!modelsReady}
          error={cameraError}
          placeholder={<p>Enable the webcam to begin multi-angle capture.</p>}
        />

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-[#0047AB]/75">
            <span>Samples captured</span>
            <span>
              {sampleCount} / {TARGET_SAMPLES}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#A2D4ED]/40">
            <div
              className="h-full bg-[#0047AB] transition-all duration-300"
              style={{ width: `${Math.min(100, (sampleCount / TARGET_SAMPLES) * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void startCamera()} disabled={capturing}>
            <Camera className="size-4" />
            {cameraActive ? "Restart camera" : "Enable camera"}
          </Button>
          <Button
            type="button"
            className="bg-[#F9BF15] font-semibold text-[#05082E] hover:bg-[#E88D1D] hover:text-white"
            disabled={!cameraActive || capturing || saving}
            onClick={() => void captureSamples()}
          >
            {capturing || saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {capturing ? "Capturing angles…" : "Saving…"}
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Capture &amp; register
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
