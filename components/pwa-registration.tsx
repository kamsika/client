"use client"

import { useEffect, useState } from "react"

export function PwaRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    let refreshing = false
    const register = async () => {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
      if (registration.waiting && navigator.serviceWorker.controller) setUpdateAvailable(true)
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing
        if (!worker) return
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateAvailable(true)
        })
      })
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
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
    }
  }, [])

  if (!updateAvailable) return null
  return (
    <div className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[100] flex items-center justify-between gap-3 rounded-lg bg-primary p-3 text-sm text-primary-foreground shadow-lg sm:inset-x-auto sm:right-4 sm:max-w-sm">
      <span>A new version is available.</span>
      <button
        className="shrink-0 rounded-md bg-background px-3 py-1.5 font-medium text-foreground"
        onClick={() => navigator.serviceWorker.controller?.postMessage({ type: "SKIP_WAITING" })}
      >
        Refresh
      </button>
    </div>
  )
}
