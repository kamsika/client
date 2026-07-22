export function buildStudentQrPayload(registrationNo: string) {
  return JSON.stringify({ registration_no: registrationNo.trim() })
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
