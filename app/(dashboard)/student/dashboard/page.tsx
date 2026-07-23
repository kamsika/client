"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { DashboardShell } from "@/components/dashboard-shell"
import { MetricsChart } from "@/components/metrics-chart"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getActiveSession, getStudyAnalytics, toggleStudySession } from "@/services/study-log"
import type { StudyLog } from "@/types"

const studentNav = [
  { href: "/student/dashboard", label: "Dashboard" },
  { href: "/student/analytics", label: "Analytics" },
]

export default function StudentDashboardPage() {
  const [activeSession, setActiveSession] = useState<StudyLog | null>(null)
  const [analytics, setAnalytics] = useState<{ series: { date: string; minutes: number }[]; total_hours?: number }>({
    series: [],
  })
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [session, data] = await Promise.all([getActiveSession(), getStudyAnalytics(14)])
      setActiveSession(session)
      setAnalytics(data)
    } catch {
      toast.error("Failed to load dashboard")
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchDashboard() {
      try {
        const [session, data] = await Promise.all([getActiveSession(), getStudyAnalytics(14)])
        if (cancelled) {
          return
        }
        setActiveSession(session)
        setAnalytics(data)
      } catch {
        if (!cancelled) {
          toast.error("Failed to load dashboard")
        }
      }
    }

    void fetchDashboard()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleToggle() {
    setLoading(true)
    try {
      const result = await toggleStudySession()
      toast.success(result.action === "started" ? "Study session started" : "Study session stopped")
      await loadData()
    } catch {
      toast.error("Failed to toggle study session")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardShell title="Student Dashboard" navItems={studentNav} allowedRoles={["student"]}>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Study Timer</CardTitle>
            <CardDescription>Track your preparation sessions</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">
                {activeSession ? "Session Active" : "No Active Session"}
              </p>
              {activeSession && (
                <p className="text-muted-foreground text-sm">
                  Started at {new Date(activeSession.start_time).toLocaleTimeString()}
                </p>
              )}
              <p className="text-muted-foreground mt-2 text-sm">
                Total study hours (14 days): {analytics.total_hours ?? 0}h
              </p>
            </div>
            <Button size="lg" disabled={loading} onClick={handleToggle}>
              {activeSession ? "Stop Session" : "Start Session"}
            </Button>
          </CardContent>
        </Card>

        <MetricsChart
          title="Recent Study Trend"
          description="Last 14 days of study activity"
          data={analytics.series}
        />

        <Card>
          <CardHeader>
            <CardTitle>Performance Analytics</CardTitle>
            <CardDescription>View detailed study patterns over time</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/student/analytics">
              <Button variant="outline">Open Analytics</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
