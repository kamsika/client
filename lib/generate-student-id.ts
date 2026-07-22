import type { Student } from "@/types"

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
