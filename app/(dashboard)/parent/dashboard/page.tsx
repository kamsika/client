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
import { getStudentAttendance } from "@/services/attendance"
import { getMyChildren } from "@/services/student"
import type { Attendance, Student } from "@/types"

const parentNav = [{ href: "/parent/dashboard", label: "Dashboard" }]

export default function ParentDashboardPage() {
  const [children, setChildren] = useState<Student[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [attendance, setAttendance] = useState<Attendance[]>([])

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
    getStudentAttendance(Number(selectedId))
      .then((data) => setAttendance(data.attendance))
      .catch(() => toast.error("Failed to load attendance"))
  }, [selectedId])

  const columns: ColumnDef<Attendance>[] = [
    { accessorKey: "date", header: "Date" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      accessorKey: "arrival_time",
      header: "Arrival Time",
      cell: ({ row }) =>
        row.original.arrival_time ? new Date(row.original.arrival_time).toLocaleString() : "-",
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
              <Select value={selectedId} onValueChange={(v) => v && setSelectedId(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={String(child.id)}>
                      {child.full_name}
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
      </div>
    </DashboardShell>
  )
}
