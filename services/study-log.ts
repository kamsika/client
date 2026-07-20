import { apiClient } from "@/lib/api-client"
import type { StudyAnalytics, StudyLog } from "@/types"

export async function toggleStudySession() {
  const { data } = await apiClient.post<{ study_log: StudyLog; action: string }>("/api/study-logs/toggle")
  return data
}

export async function getStudyAnalytics(days = 30) {
  const { data } = await apiClient.get<StudyAnalytics>("/api/study-logs/analytics", { params: { days } })
  return data
}

export async function getActiveSession() {
  const { data } = await apiClient.get<{ active_session: StudyLog | null }>("/api/study-logs/active")
  return data.active_session
}
