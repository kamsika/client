import { apiClient } from "@/lib/api-client"
import type { SmsLog } from "@/types"

export async function listSmsLogs() {
  const { data } = await apiClient.get<{ sms_logs: SmsLog[] }>("/api/sms-logs")
  return data.sms_logs
}
