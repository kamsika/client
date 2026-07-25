"use client"

import type { AttendanceSummary } from "@/types"
import { cn } from "@/lib/utils"

interface AttendanceSummaryStatsProps {
  summary: AttendanceSummary | null
  className?: string
}

const cards = [
  {
    key: "enrolled" as const,
    label: "Total Enrolled",
    emoji: "👥",
    value: (s: AttendanceSummary) => s.total_enrolled,
    accent: "border-sky-200 bg-sky-50 text-sky-950",
  },
  {
    key: "present" as const,
    label: "Total Present",
    emoji: "🟢",
    value: (s: AttendanceSummary) => s.total_present,
    accent: "border-emerald-200 bg-emerald-50 text-emerald-950",
  },
  {
    key: "absent" as const,
    label: "Total Absent",
    emoji: "🔴",
    value: (s: AttendanceSummary) => s.total_absent,
    accent: "border-rose-200 bg-rose-50 text-rose-950",
  },
  {
    key: "rate" as const,
    label: "Attendance Rate",
    emoji: "📊",
    value: (s: AttendanceSummary) => `${s.attendance_rate}%`,
    accent: "border-amber-200 bg-amber-50 text-amber-950",
  },
]

export function AttendanceSummaryStats({ summary, className }: AttendanceSummaryStatsProps) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {cards.map((card) => (
        <div
          key={card.key}
          className={cn("rounded-lg border px-4 py-3 shadow-none", card.accent)}
        >
          <p className="text-xs font-medium tracking-wide uppercase opacity-80">
            {card.emoji} {card.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {summary ? card.value(summary) : "—"}
          </p>
        </div>
      ))}
    </div>
  )
}
