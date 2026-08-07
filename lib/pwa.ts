export const PWA_CACHE_PREFIXES = ["sms-pwa-", "ahms-pwa-"] as const
export const OFFLINE_ATTENDANCE_MESSAGE =
  "You are offline. Connect to the internet to mark attendance."

export function isPwaEnabled() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_ENABLE_PWA_IN_DEV === "true"
  )
}

/** Remove only this application's caches; authentication storage is separate. */
export async function clearPwaCaches() {
  if (typeof window === "undefined") return

  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_APP_CACHES" })

  if (!("caches" in window)) return
  const keys = await window.caches.keys()
  await Promise.all(
    keys
      .filter((key) => PWA_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .map((key) => window.caches.delete(key)),
  )
}
