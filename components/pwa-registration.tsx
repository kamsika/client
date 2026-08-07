"use client"

import { useEffect } from "react"

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined)
    }
    const timeoutId = window.setTimeout(register, 1000)
    return () => window.clearTimeout(timeoutId)
  }, [])

  return null
}
