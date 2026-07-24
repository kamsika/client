"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { localTodayISO } from "@/lib/format-time"
import { cn } from "@/lib/utils"

interface AttendanceDatePickerProps {
  value: string
  onChange: (date: string) => void
  id?: string
  label?: string
  className?: string
  disabled?: boolean
}

export function AttendanceDatePicker({
  value,
  onChange,
  id = "attendance-date",
  label = "Date",
  className,
  disabled,
}: AttendanceDatePickerProps) {
  const today = localTodayISO()

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        value={value}
        max={today}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value
          if (!next) return
          onChange(next > today ? today : next)
        }}
      />
    </div>
  )
}
