"use client"

import { Check, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Attendance } from "@/types"

interface AttendanceToggleProps {
  studentId: number
  studentName: string
  attendance: Attendance | null
  loading?: boolean
  onMark: (studentId: number, status?: string) => Promise<void>
}

export function AttendanceToggle({
  studentId,
  studentName,
  attendance,
  loading,
  onMark,
}: AttendanceToggleProps) {
  const status = attendance?.status

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <p className="font-medium">{studentName}</p>
        {attendance?.arrival_time && (
          <p className="text-muted-foreground text-sm">
            Arrived: {new Date(attendance.arrival_time).toLocaleTimeString()}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={status === "Present" ? "default" : "outline"}
          disabled={loading}
          onClick={() => onMark(studentId, "Present")}
          className={cn(status === "Present" && "bg-green-600 hover:bg-green-700")}
        >
          <Check className="size-4" />
          Present
        </Button>
        <Button
          size="sm"
          variant={status === "Absent" ? "default" : "outline"}
          disabled={loading}
          onClick={() => onMark(studentId, "Absent")}
          className={cn(status === "Absent" && "bg-red-600 hover:bg-red-700")}
        >
          <X className="size-4" />
          Absent
        </Button>
      </div>
    </div>
  )
}
