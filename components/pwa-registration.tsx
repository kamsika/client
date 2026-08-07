"use client"

import { useEffect, useState } from "react"

import { ConnectionStatus } from "@/components/connection-status"
import { PwaInstallPrompt } from "@/components/pwa-install-prompt"
import { Button } from "@/components/ui/button"
import { isPwaEnabled } from "@/lib/pwa"

export function PwaRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!isPwaEnabled() || !("serviceWorker" in navigator) || !window.isSecureContext) return
    let refreshing = false
    let registration: ServiceWorkerRegistration | null = null
    let installingWorker: ServiceWorker | null = null

    const onWorkerStateChange = () => {
      if (installingWorker?.state === "installed" && navigator.serviceWorker.controller) {
        setUpdateAvailable(true)
      }
    }
    const onUpdateFound = () => {
      installingWorker?.removeEventListener("statechange", onWorkerStateChange)
      installingWorker = registration?.installing ?? null
      installingWorker?.addEventListener("statechange", onWorkerStateChange)
    }
    const register = async () => {
      registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      if (registration.waiting && navigator.serviceWorker.controller) setUpdateAvailable(true)
      registration.addEventListener("updatefound", onUpdateFound)
    }
    const onControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)
    const timeoutId = window.setTimeout(() => void register().catch(() => undefined), 1000)
    return () => {
      window.clearTimeout(timeoutId)
      installingWorker?.removeEventListener("statechange", onWorkerStateChange)
      registration?.removeEventListener("updatefound", onUpdateFound)
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[100] space-y-2 sm:inset-x-auto sm:right-[max(1rem,env(safe-area-inset-right))] sm:w-full sm:max-w-sm">
      <div className="pointer-events-auto">
        <ConnectionStatus />
      </div>
      <div className="pointer-events-auto">
        <PwaInstallPrompt />
      </div>
      {updateAvailable ? (
        <div role="status" className="pointer-events-auto flex items-center justify-between gap-3 rounded-lg bg-primary p-3 text-sm text-primary-foreground shadow-lg">
          <span>New version available</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => navigator.serviceWorker.controller?.postMessage({ type: "SKIP_WAITING" })}
          >
            Refresh
          </Button>
        </div>
      ) : null}
    </div>
  )
}
