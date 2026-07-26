import { apiClient } from "@/lib/api-client"
import type { Classroom } from "@/types"

export type CreateClassroomSubjectTeacher = {
  subject: string
  teacher_id: number
}

export type CreateClassroomTimetableSlot = {
  dayOfWeek: string
  subjectName: string
  startTime: string
  endTime: string
  teacherId?: number
}

export async function listClassrooms() {
  const { data } = await apiClient.get<{ classrooms: Classroom[] }>("/api/classrooms")
  return data.classrooms
}

export async function createClassroom(payload: {
  name: string
  grade?: string
  schedule_start_time?: string
  teacher_id?: number
  subject_teachers?: CreateClassroomSubjectTeacher[]
  timetable?: CreateClassroomTimetableSlot[]
}) {
  const { data } = await apiClient.post<{ classroom: Classroom }>("/api/classrooms", payload)
  return data.classroom
}
