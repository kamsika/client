"use client"

import { useEffect, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { DashboardShell } from "@/components/dashboard-shell"
import { LogsTable, StatusBadge } from "@/components/logs-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { selectItems } from "@/lib/select-items"
import { formatLocalDateTime } from "@/lib/format-time"
import { getStudentAttendance } from "@/services/attendance"
import { getMyChildren } from "@/services/student"
import type { Attendance, Student } from "@/types"
import { FeeSummaryCard } from "@/components/fee-summary-card"
import { getStudentFeeHistory, getStudentFeeSummary, type FeeSummary } from "@/services/tuition"

const parentNav = [{ href: "/parent/dashboard", label: "Dashboard" }]

export default function ParentDashboardPage() {
  const [children, setChildren] = useState<Student[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null)
  const [feeUnavailable, setFeeUnavailable] = useState(false)
  const [feeHistory, setFeeHistory] = useState<Awaited<ReturnType<typeof getStudentFeeHistory>> | null>(null)

  useEffect(() => {
    getMyChildren()
      .then((data) => {
        setChildren(data)
        if (data.length > 0) setSelectedId(String(data[0].id))
      })
      .catch(() => toast.error("Failed to load children"))
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setFeeUnavailable(false)
    getStudentAttendance(Number(selectedId))
      .then((data) => setAttendance(data.attendance))
      .catch(() => toast.error("Failed to load attendance"))
    getStudentFeeSummary(Number(selectedId))
      .then(setFeeSummary)
      .catch(() => setFeeUnavailable(true))
    getStudentFeeHistory(Number(selectedId)).then(setFeeHistory).catch(() => setFeeHistory(null))
  }, [selectedId])

  const columns: ColumnDef<Attendance>[] = [
    { accessorKey: "date", header: "Date" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      accessorKey: "arrival_time",
      header: "Arrival Time",
      cell: ({ row }) => formatLocalDateTime(row.original.arrival_time),
    },
  ]

  const lateCount = attendance.filter((a) => a.status === "Late").length
  const absentCount = attendance.filter((a) => a.status === "Absent").length

  return (
    <DashboardShell title="Parent Dashboard" navItems={parentNav} allowedRoles={["parent"]}>
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Late Arrivals</CardDescription>
              <CardTitle className="text-3xl">{lateCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Absences</CardDescription>
              <CardTitle className="text-3xl">{absentCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Total Records</CardDescription>
              <CardTitle className="text-3xl">{attendance.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Attendance & Alerts</CardTitle>
              <CardDescription>Real-time entry logs and absence metrics for your child</CardDescription>
            </div>
            {children.length > 0 && (
              <Select
                value={selectedId}
                onValueChange={(v) => v && setSelectedId(v)}
                items={selectItems(
                  children.map((child) => ({
                    value: child.id,
                    label: child.full_name || child.registration_no || `Student #${child.id}`,
                  })),
                )}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={String(child.id)}>
                      {child.full_name || child.registration_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent>
            {children.length === 0 ? (
              <p className="text-muted-foreground text-sm">No linked student profiles found.</p>
            ) : (
              <LogsTable data={attendance} columns={columns} />
            )}
          </CardContent>
        </Card>
        {selectedId ? <FeeSummaryCard summary={feeSummary} unavailable={feeUnavailable} /> : null}
        {selectedId && feeHistory ? <Card><CardHeader><CardTitle>Invoice & Payment History</CardTitle><CardDescription>Receipts and historical subject charges for the selected child.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2"><p className="font-medium">Invoices</p>{feeHistory.invoices.length === 0 ? <p className="text-muted-foreground text-sm">No invoices yet.</p> : feeHistory.invoices.map((invoice) => <div key={String(invoice.id)} className="rounded-lg border p-3 text-sm"><div className="flex justify-between"><span>{String(invoice.billing_period)}</span><span>{String(invoice.status)}</span></div><p>Balance: Rs. {Number(invoice.balance_due || 0).toLocaleString()}</p></div>)}</div>
          <div className="space-y-2"><p className="font-medium">Payments & receipts</p>{feeHistory.payments.length === 0 ? <p className="text-muted-foreground text-sm">No payments yet.</p> : feeHistory.payments.map((payment) => <div key={String(payment.id)} className="rounded-lg border p-3 text-sm"><div className="flex justify-between"><span>Rs. {Number(payment.amount || 0).toLocaleString()}</span><span>{String(payment.status)}</span></div><p>Receipt: {String(payment.receipt_number || "—")}</p></div>)}</div>
        </CardContent></Card> : null}
      </div>
    </DashboardShell>
  )
}
