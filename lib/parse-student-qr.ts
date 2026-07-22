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

export function parseStudentQr(rawValue: string): ParsedStudentQr | null {
  const value = rawValue.trim()
  if (!value) return null

  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value) as { student_id?: number; registration_no?: string }
      if (parsed.student_id) return { studentId: Number(parsed.student_id) }
      if (parsed.registration_no) return { registrationNo: parsed.registration_no.trim() }
    } catch {
      return null
    }
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

  const asId = Number(value)
  if (!Number.isNaN(asId) && String(asId) === value) {
    return { studentId: asId }
  }

  return { registrationNo: value }
}
