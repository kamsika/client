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
  const showLabel = Boolean(label?.trim())

  return (
    <div className={cn(showLabel ? "space-y-2" : undefined, className)}>
      {showLabel ? <Label htmlFor={id}>{label}</Label> : null}
      <Input
        id={id}
        type="date"
        value={value}
        max={today}
        disabled={disabled}
        className="h-10 w-full border-[#A2D4ED] bg-white transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"
        onChange={(event) => {
          const next = event.target.value
          if (!next) return
          onChange(next > today ? today : next)
        }}
      />
    </div>
  )
}
