"use client"

import { forwardRef, useImperativeHandle, useRef } from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

export type FaceCameraHandle = {
  getVideo: () => HTMLVideoElement | null
}

interface FaceCameraProps {
  active?: boolean
  loading?: boolean
  error?: string | null
  className?: string
  overlay?: React.ReactNode
  placeholder?: React.ReactNode
}

export const FaceCamera = forwardRef<FaceCameraHandle, FaceCameraProps>(function FaceCamera(
  { active = false, loading = false, error, className, overlay, placeholder },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useImperativeHandle(ref, () => ({
    getVideo: () => videoRef.current,
  }))

  return (
    <div className={cn("relative min-h-[280px] overflow-hidden rounded-lg border border-[#A2D4ED]/50 bg-black", className)}>
      <video ref={videoRef} className="min-h-[280px] w-full object-cover" muted playsInline />

      {overlay}

      {!active && (
        <div className="absolute inset-0 flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/85">
          {loading ? (
            <>
              <Loader2 className="size-8 animate-spin text-[#A2D4ED]" />
              <p>Loading face models…</p>
            </>
          ) : (
            placeholder ?? <p>Camera is off.</p>
          )}
        </div>
      )}

      {error && (
        <div className="absolute inset-x-0 bottom-0 border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  )
})
