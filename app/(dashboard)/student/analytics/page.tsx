"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { DashboardShell } from "@/components/dashboard-shell"
import { MetricsChart } from "@/components/metrics-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getStudyAnalytics } from "@/services/study-log"

const studentNav = [
  { href: "/student/dashboard", label: "Dashboard" },
  { href: "/student/analytics", label: "Analytics" },
]

export default function StudentAnalyticsPage() {
  const [days, setDays] = useState("30")
  const [analytics, setAnalytics] = useState<{
    series: { date: string; minutes: number }[]
    total_minutes: number
    total_hours?: number
  }>({ series: [], total_minutes: 0 })

  useEffect(() => {
    getStudyAnalytics(Number(days))
      .then(setAnalytics)
      .catch(() => toast.error("Failed to load analytics"))
  }, [days])

  return (
    <DashboardShell title="Study Analytics" navItems={studentNav} allowedRoles={["student"]}>
      <div className="grid gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Study Hours Trend</CardTitle>
              <CardDescription>Increase or decrease over chronological ranges</CardDescription>
            </div>
            <Select value={days} onValueChange={(v) => v && setDays(v)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Total Minutes</p>
              <p className="text-2xl font-bold">{analytics.total_minutes}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Total Hours</p>
              <p className="text-2xl font-bold">{analytics.total_hours ?? 0}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Active Days</p>
              <p className="text-2xl font-bold">{analytics.series.length}</p>
            </div>
          </CardContent>
        </Card>

        <MetricsChart data={analytics.series} />
      </div>
    </DashboardShell>
  )
}
