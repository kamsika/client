"use client"

import { useEffect, useState } from "react"
import { Download, Share2, X } from "lucide-react"

import { Button } from "@/components/ui/button"

const DISMISS_KEY = "sms-pwa-install-dismissed-at"
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if (isStandalone()) return
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (Date.now() - dismissedAt < DISMISS_FOR_MS) return

    const ios = isIosDevice()
    if (ios) {
      setShowIosHelp(true)
      setHidden(false)
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      setHidden(false)
    }
    const onInstalled = () => {
      setInstallEvent(null)
      setShowIosHelp(false)
      setHidden(true)
      localStorage.removeItem(DISMISS_KEY)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setHidden(true)
  }

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    setInstallEvent(null)
    if (choice.outcome === "dismissed") dismiss()
  }

  if (hidden || (!installEvent && !showIosHelp)) return null

  return (
    <section
      aria-label="Install Student Management System"
      className="rounded-lg border border-[#A2D4ED] bg-white p-3 text-sm text-[#05082E] shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-2">
          {showIosHelp ? (
            <Share2 className="mt-0.5 size-4 shrink-0 text-[#0047AB]" aria-hidden="true" />
          ) : (
            <Download className="mt-0.5 size-4 shrink-0 text-[#0047AB]" aria-hidden="true" />
          )}
          <div>
            <p className="font-semibold">Install App</p>
            <p className="mt-1 text-xs text-[#0047AB]/75">
              {showIosHelp
                ? "Open Share and select Add to Home Screen."
                : "Install for faster access from your home screen or desktop."}
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={dismiss} aria-label="Dismiss install suggestion">
          <X className="size-4" />
        </Button>
      </div>
      {installEvent ? (
        <Button type="button" size="sm" className="mt-3 w-full" onClick={() => void install()}>
          <Download className="size-4" />
          Install App
        </Button>
      ) : null}
    </section>
  )
}

