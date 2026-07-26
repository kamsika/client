import { apiClient } from "@/lib/api-client"
import type { TimetableSlot } from "@/types"

export interface UpsertTimetableInput {
  id?: number
  classroomId?: number
  studentId?: number
  dayOfWeek: string
  subjectName: string
  startTime: string
  endTime: string
}

export async function listTimetable(params?: {
  classroomId?: number
  studentId?: number
}) {
  const { data } = await apiClient.get<{
    timetable: TimetableSlot[]
    slots: TimetableSlot[]
    count: number
    tenantId?: number | null
  }>("/api/timetable", {
    params: {
      classroomId: params?.classroomId,
      studentId: params?.studentId,
    },
  })
  return data.timetable ?? data.slots ?? []
}

export async function upsertTimetable(payload: UpsertTimetableInput) {
  const { data } = await apiClient.post<{
    success: boolean
    message: string
    timetable: TimetableSlot
    slot: TimetableSlot
  }>("/api/timetable", payload)
  return data.slot ?? data.timetable
}

export async function deleteTimetable(slotId: number) {
  const { data } = await apiClient.delete<{
    success: boolean
    message: string
    timetable: TimetableSlot
    slot: TimetableSlot
  }>(`/api/timetable/${slotId}`)
  return data
}
