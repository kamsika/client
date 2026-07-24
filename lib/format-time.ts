/**
 * Default display timezone for Sri Lanka / India (+05:30).
 * Browser locale is still used for formatting style; this locks the clock zone.
 */
export const APP_DISPLAY_TIMEZONE =
  process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Colombo"

function normalizeApiTimestamp(value: string): string {
  const trimmed = value.trim()
  // Already has timezone designator.
  if (/Z$/i.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed
  }
  // Backend historically stored naive UTC — treat as UTC.
  return `${trimmed}Z`
}

export function parseApiTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(normalizeApiTimestamp(value))
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function formatLocalTime(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = parseApiTimestamp(value)
  if (!date) return "—"

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: APP_DISPLAY_TIMEZONE,
    ...options,
  })
}

export function formatLocalDateTime(value: string | null | undefined): string {
  const date = parseApiTimestamp(value)
  if (!date) return "—"

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: APP_DISPLAY_TIMEZONE,
  })
}

/** Calendar date (YYYY-MM-DD) in the app timezone — matches backend local_today(). */
export function localTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_DISPLAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

export function formatAttendanceDayLabel(dateISO: string): string {
  if (!dateISO) return ""
  if (dateISO === localTodayISO()) return `Today · ${dateISO}`
  const [year, month, day] = dateISO.split("-").map(Number)
  if (!year || !month || !day) return dateISO
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}
