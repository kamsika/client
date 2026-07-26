import { apiClient } from "@/lib/api-client"
import type { Classroom, TimetableSlot } from "@/types"

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

export type ClassroomPayload = {
  name: string
  grade?: string
  schedule_start_time?: string
  teacher_id?: number
  subject_teachers?: CreateClassroomSubjectTeacher[]
  timetable?: CreateClassroomTimetableSlot[]
}

export type ClassroomDetail = Classroom & {
  timetable?: TimetableSlot[]
}

export async function listClassrooms() {
  const { data } = await apiClient.get<{ classrooms: Classroom[] }>("/api/classrooms")
  return data.classrooms
}

export async function getClassroom(classroomId: number) {
  const { data } = await apiClient.get<{ classroom: ClassroomDetail }>(
    `/api/classrooms/${classroomId}`,
  )
  return data.classroom
}

export async function createClassroom(payload: ClassroomPayload) {
  const { data } = await apiClient.post<{ classroom: Classroom }>("/api/classrooms", payload)
  return data.classroom
}

export async function updateClassroom(classroomId: number, payload: ClassroomPayload) {
  const { data } = await apiClient.put<{ classroom: ClassroomDetail }>(
    `/api/classrooms/${classroomId}`,
    payload,
  )
  return data.classroom
}
