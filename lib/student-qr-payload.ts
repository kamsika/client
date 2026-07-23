/** Minimum on-screen QR size for reliable camera scanning. */
export const STUDENT_QR_SIZE = 280

/** Quiet-zone modules around the QR (white border). */
export const STUDENT_QR_MARGIN_MODULES = 4

/**
 * QR payload must stay simple for reliable mobile scanning.
 * Stores ONLY the plain student ID / registration string (e.g. "STU-2026-001").
 */
export function buildStudentQrPayload(studentId: string) {
  return studentId.trim()
}

export function studentQrDownloadFilename(studentId: string) {
  return `${studentId.trim()}_qr.png`
}

export function studentInitials(fullName: string | null) {
  if (!fullName?.trim()) return "?"
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}
