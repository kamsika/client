"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react"

import type { AttendanceSubjectOption } from "@/services/attendance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AttendanceSubjectSelectionDialogProps {
  open: boolean
  studentName: string
  options: AttendanceSubjectOption[]
  paymentStatus?: "Pending" | "Paid" | "Overdue"
  onOpenChange: (open: boolean) => void
  onConfirm: (selectedSubjects: string[]) => Promise<void>
}

function optionSubject(option: AttendanceSubjectOption) {
  return option.subjectName || option.subject_name || "Subject"
}

function optionRange(option: AttendanceSubjectOption) {
  return option.timeRange || `${option.startTime} - ${option.endTime}`
}

export function AttendanceSubjectSelectionDialog({
  open,
  studentName,
  options,
  paymentStatus,
  onOpenChange,
  onConfirm,
}: AttendanceSubjectSelectionDialogProps) {
  const initialSelection = useMemo(
    () => options.filter((option) => option.selected !== false).map(optionSubject),
    [options],
  )
  const [selected, setSelected] = useState<string[]>([])
  const effectiveSelection = selected.length > 0 ? selected : initialSelection
  const [saving, setSaving] = useState(false)

  function toggle(option: AttendanceSubjectOption) {
    if (option.disabled || option.isCurrent || option.is_current) return
    const subject = optionSubject(option)
    setSelected((current) => {
      const base = current.length > 0 ? current : initialSelection
      return base.some((item) => item.toLowerCase() === subject.toLowerCase())
        ? base.filter((item) => item.toLowerCase() !== subject.toLowerCase())
        : [...base, subject]
    })
  }

  async function confirm() {
    setSaving(true)
    try {
      await onConfirm(effectiveSelection)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm consecutive classes</DialogTitle>
          <DialogDescription>
            {studentName} is present for the current class. Untick any upcoming class the student
            will not attend.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {options.map((option) => {
            const subject = optionSubject(option)
            const checked = effectiveSelection.some(
              (item) => item.toLowerCase() === subject.toLowerCase(),
            )
            const locked = Boolean(option.disabled || option.isCurrent || option.is_current)
            return (
              <button
                key={`${option.slotId}-${subject}`}
                type="button"
                disabled={locked}
                onClick={() => toggle(option)}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                    checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-muted-foreground/40"
                  }`}
                >
                  {checked && <CheckCircle2 className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{subject}</span>
                  <span className="text-muted-foreground block text-xs">{optionRange(option)}</span>
                </span>
                <Badge variant={option.isCurrent || option.is_current ? "default" : "outline"}>
                  {option.isCurrent || option.is_current ? "Current" : "Upcoming"}
                </Badge>
              </button>
            )
          })}
        </div>

        {paymentStatus && (
          <div className="bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <CreditCard className="text-muted-foreground size-4" />
            <span className="text-muted-foreground">Monthly fee:</span>
            <Badge
              className={
                paymentStatus === "Paid"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }
            >
              {paymentStatus}
            </Badge>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Skip upcoming
          </Button>
          <Button type="button" onClick={() => void confirm()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Confirm attendance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
