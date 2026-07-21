"use client"

import { useEffect, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { DashboardShell } from "@/components/dashboard-shell"
import { LogsTable, StatusBadge } from "@/components/logs-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminNav } from "@/lib/admin-nav"
import { listSmsLogs } from "@/services/sms-log"
import type { SmsLog } from "@/types"

const smsColumns: ColumnDef<SmsLog>[] = [
  {
    accessorKey: "sent_at",
    header: "Sent At",
    cell: ({ row }) => new Date(row.original.sent_at).toLocaleString(),
  },
  { accessorKey: "recipient_phone", header: "Phone" },
  { accessorKey: "message_body", header: "Message" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "error_details",
    header: "Error Details",
    cell: ({ row }) => row.original.error_details ?? "—",
  },
]

export default function SmsLogsPage() {
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listSmsLogs()
      .then(setSmsLogs)
      .catch(() => toast.error("Failed to load SMS logs"))
      .finally(() => setLoading(false))
  }, [])

  const deliveredCount = smsLogs.filter((log) => log.status === "Delivered" || log.status === "Sent").length
  const failedCount = smsLogs.filter((log) => log.status === "Failed").length

  return (
    <DashboardShell title="SMS Logs" navItems={getAdminNav(false)} allowedRoles={["institution_admin"]}>
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Total Messages</CardDescription>
              <CardTitle className="text-3xl">{loading ? "—" : smsLogs.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Delivered / Sent</CardDescription>
              <CardTitle className="text-3xl">{loading ? "—" : deliveredCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Failed</CardDescription>
              <CardTitle className="text-3xl">{loading ? "—" : failedCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>SMS Delivery Logs</CardTitle>
            <CardDescription>Complete audit trail for parent notifications and dispute resolution</CardDescription>
          </CardHeader>
          <CardContent>
            <LogsTable
              data={smsLogs}
              columns={smsColumns}
              emptyMessage={loading ? "Loading SMS logs..." : "No SMS logs yet."}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
