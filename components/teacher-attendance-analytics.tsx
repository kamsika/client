"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { TeacherAttendanceOverview } from "@/types"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

interface TeacherAttendanceAnalyticsProps {
  analytics: NonNullable<TeacherAttendanceOverview["analytics"]> | null | undefined
  className?: string
}

export function TeacherAttendanceAnalytics({
  analytics,
  className,
}: TeacherAttendanceAnalyticsProps) {
  const gradeWise = analytics?.gradeWise ?? analytics?.grade_wise ?? []
  const subjectWise = analytics?.subjectWise ?? analytics?.subject_wise ?? []
  const monthly = analytics?.monthly ?? []

  return (
    <div className={cn("grid gap-4 lg:grid-cols-2", className)}>
      <Card className={cn(cardShell, "py-4")}>
        <CardHeader className="px-5 pb-2">
          <CardTitle className="text-base text-[#05082E]">Grade-wise attendance %</CardTitle>
          <CardDescription className="text-[#0047AB]/75">
            Present students vs roster for the selected filters
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-4 sm:px-5">
          {gradeWise.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#0047AB]/70">No grade data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={gradeWise}>
                <CartesianGrid strokeDasharray="3 3" stroke="#A2D4ED66" />
                <XAxis dataKey="grade" tick={{ fontSize: 11, fill: "#0047AB" }} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#0047AB" }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  formatter={(value) => [`${value ?? 0}%`, "Attendance"]}
                  contentStyle={{ borderRadius: 12, borderColor: "#A2D4ED" }}
                />
                <Bar dataKey="percentage" fill="#05082E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className={cn(cardShell, "py-4")}>
        <CardHeader className="px-5 pb-2">
          <CardTitle className="text-base text-[#05082E]">Subject-wise attendance %</CardTitle>
          <CardDescription className="text-[#0047AB]/75">
            Present marks against enrolled students per subject
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-4 sm:px-5">
          {subjectWise.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#0047AB]/70">No subject data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={subjectWise}>
                <CartesianGrid strokeDasharray="3 3" stroke="#A2D4ED66" />
                <XAxis dataKey="subject" tick={{ fontSize: 11, fill: "#0047AB" }} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#0047AB" }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  formatter={(value) => [`${value ?? 0}%`, "Attendance"]}
                  contentStyle={{ borderRadius: 12, borderColor: "#A2D4ED" }}
                />
                <Bar dataKey="percentage" fill="#0047AB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className={cn(cardShell, "py-4 lg:col-span-2")}>
        <CardHeader className="px-5 pb-2">
          <CardTitle className="text-base text-[#05082E]">Monthly attendance report</CardTitle>
          <CardDescription className="text-[#0047AB]/75">
            Unique students marked Present / Late each day this month
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-4 sm:px-5">
          {monthly.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#0047AB]/70">No monthly data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#A2D4ED66" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#0047AB" }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#0047AB" }} />
                <Tooltip
                  formatter={(value) => [`${value ?? 0}`, "Present students"]}
                  labelFormatter={(label) => `Day: ${label}`}
                  contentStyle={{ borderRadius: 12, borderColor: "#A2D4ED" }}
                />
                <Line
                  type="monotone"
                  dataKey="presentCount"
                  stroke="#E88D1D"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#F9BF15" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
