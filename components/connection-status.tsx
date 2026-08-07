"use client"

import { useEffect, useRef, useState } from "react"
import { CloudOff, Wifi } from "lucide-react"
import { toast } from "sonner"

import { useOnlineStatus } from "@/hooks/use-online-status"
import { OFFLINE_ATTENDANCE_MESSAGE } from "@/lib/pwa"

export function ConnectionStatus() {
  const online = useOnlineStatus()
  const wasOffline = useRef(false)
  const [showBackOnline, setShowBackOnline] = useState(false)

  useEffect(() => {
    if (!online) {
      wasOffline.current = true
      setShowBackOnline(false)
      return
    }
    if (!wasOffline.current) return
    wasOffline.current = false
    setShowBackOnline(true)
    toast.success("Back online")
    const timer = window.setTimeout(() => setShowBackOnline(false), 3000)
    return () => window.clearTimeout(timer)
  }, [online])

  if (online && !showBackOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        online
          ? "flex items-center gap-2 rounded-lg border border-emerald-200 bg-white p-3 text-sm text-emerald-800 shadow-lg"
          : "rounded-lg border border-amber-300 bg-white p-3 text-sm text-[#05082E] shadow-lg"
      }
    >
      {online ? (
        <>
          <Wifi className="size-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">Back online</span>
        </>
      ) : (
        <div className="flex gap-2">
          <CloudOff className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <p className="font-medium">{OFFLINE_ATTENDANCE_MESSAGE}</p>
            <p className="mt-1 text-xs text-[#0047AB]/75">
              Only limited cached public content may be available. Nothing will be submitted automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

