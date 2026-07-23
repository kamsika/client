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
