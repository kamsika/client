import type { Student } from "@/types"

function normalizeName(name: string) {
  return name.trim().toLowerCase()
}

function normalizeContact(contact: string) {
  return contact.replace(/\s+/g, "").trim()
}

export function findDuplicateStudent(
  students: Student[],
  name: string,
  contact: string,
): Student | undefined {
  const normalizedName = normalizeName(name)
  const normalizedContact = normalizeContact(contact)

  return students.find((student) => {
    const studentName = normalizeName(student.full_name || "")
    const studentContact = normalizeContact(student.contact || "")
    return studentName === normalizedName && studentContact === normalizedContact
  })
}

export function getNextStudentId(existingStudents: Student[]): string {
  const year = new Date().getFullYear()
  const prefix = `STU-${year}-`
  const pattern = new RegExp(`^STU-${year}-(\\d+)$`, "i")

  let maxSeq = 0
  for (const student of existingStudents) {
    const match = student.registration_no.match(pattern)
    if (match) {
      maxSeq = Math.max(maxSeq, Number.parseInt(match[1], 10))
    }
  }

  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`
}
