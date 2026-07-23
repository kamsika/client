export interface ParsedStudentQr {
  studentId?: number
  registrationNo?: string
}

export function getScannedStudentId(rawValue: string): string | null {
  const parsed = parseStudentQr(rawValue)
  if (!parsed) return null
  if (parsed.registrationNo) return parsed.registrationNo
  if (parsed.studentId !== undefined) return String(parsed.studentId)
  return rawValue.trim() || null
}

function extractFromUrl(value: string): ParsedStudentQr | null {
  try {
    const url = new URL(value)
    const studentIdParam =
      url.searchParams.get("student_id") ||
      url.searchParams.get("studentId") ||
      url.searchParams.get("id")
    const registrationParam =
      url.searchParams.get("registration_no") ||
      url.searchParams.get("registrationNo") ||
      url.searchParams.get("reg")

    if (registrationParam?.trim()) {
      return { registrationNo: registrationParam.trim() }
    }
    if (studentIdParam && !Number.isNaN(Number(studentIdParam))) {
      return { studentId: Number(studentIdParam) }
    }

    const pathParts = url.pathname.split("/").filter(Boolean)
    const last = pathParts[pathParts.length - 1]
    if (last) {
      const asId = Number(last)
      if (!Number.isNaN(asId) && String(asId) === last) {
        return { studentId: asId }
      }
      return { registrationNo: decodeURIComponent(last) }
    }
  } catch {
    return null
  }
  return null
}

export function parseStudentQr(rawValue: string): ParsedStudentQr | null {
  const value = rawValue.trim()
  if (!value) return null

  // JSON payload: {"registration_no":"..."} or {"student_id":123}
  if (value.startsWith("{") || value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as {
        student_id?: number | string
        studentId?: number | string
        registration_no?: string
        registrationNo?: string
        id?: number | string
      }
      const registration = (parsed.registration_no || parsed.registrationNo || "").toString().trim()
      if (registration) return { registrationNo: registration }

      const studentIdRaw = parsed.student_id ?? parsed.studentId ?? parsed.id
      if (studentIdRaw !== undefined && studentIdRaw !== null && String(studentIdRaw).trim()) {
        const studentId = Number(studentIdRaw)
        if (!Number.isNaN(studentId)) return { studentId }
      }
    } catch {
      // Fall through and treat as a plain string / URL.
    }
  }

  // URL payload
  if (/^https?:\/\//i.test(value)) {
    const fromUrl = extractFromUrl(value)
    if (fromUrl) return fromUrl
  }

  const studentPrefix = value.match(/^student[:/](.+)$/i)
  if (studentPrefix) {
    const token = studentPrefix[1].trim()
    const asId = Number(token)
    if (!Number.isNaN(asId) && String(asId) === token) {
      return { studentId: asId }
    }
    return { registrationNo: token }
  }

  // Pure numeric student id
  const asId = Number(value)
  if (!Number.isNaN(asId) && String(asId) === value) {
    return { studentId: asId }
  }

  // Plain registration / student code string
  return { registrationNo: value }
}
