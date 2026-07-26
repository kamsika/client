"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SelectableAttendanceSubject } from "@/services/attendance"

interface ContinuousSubjectPickerProps {
  subjects: SelectableAttendanceSubject[]
  /** Later gap/interval classes — shown without checkboxes. */
  scheduledSubjects?: SelectableAttendanceSubject[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  continuousGroup?: boolean
  submitting?: boolean
  onSubmit: () => void
  onCancel?: () => void
  className?: string
}

function subjectId(subject: SelectableAttendanceSubject) {
  return subject.id ?? subject.subjectId ?? 0
}

function subjectLabel(subject: SelectableAttendanceSubject) {
  return subject.subjectName || subject.subject_name || "Subject"
}

function subjectRange(subject: SelectableAttendanceSubject) {
  return (
    subject.timeRange ||
    subject.time_range ||
    `${subject.startTime || subject.start_time || "--"} - ${subject.endTime || subject.end_time || "--"}`
  )
}

export function ContinuousSubjectPicker({
  subjects,
  scheduledSubjects = [],
  selectedIds,
  onChange,
  continuousGroup = subjects.length > 1,
  submitting = false,
  onSubmit,
  onCancel,
  className,
}: ContinuousSubjectPickerProps) {
  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((value) => value !== id))
      return
    }
    onChange([...selectedIds, id])
  }

  const hasSelectable = subjects.length > 0

  return (
    <div className={cn("space-y-3 rounded-xl border bg-background/95 p-4 shadow-lg", className)}>
      {hasSelectable ? (
        <div>
          <p className="text-sm font-semibold">
            {continuousGroup ? "Continuous classes (≤15 min break)" : "Current class"}
          </p>
          <p className="text-muted-foreground text-xs">
            {continuousGroup
              ? "Tick one or both subjects, then submit attendance."
              : "Confirm this class to mark Present."}
          </p>
        </div>
      ) : null}

      {hasSelectable ? (
        <ul className="space-y-2">
          {subjects.map((subject) => {
            const id = subjectId(subject)
            const checked = selectedIds.includes(id)
            return (
              <li key={id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    checked ? "border-primary bg-primary/5" : "hover:bg-muted/60",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-primary"
                    checked={checked}
                    onChange={() => toggle(id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{subjectLabel(subject)}</span>
                      {subject.isCurrent || subject.is_current ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Current
                        </Badge>
                      ) : null}
                      {subject.continuous || continuousGroup ? (
                        <Badge variant="outline" className="text-[10px]">
                          Continuous
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-xs">{subjectRange(subject)}</p>
                  </div>
                </label>
              </li>
            )
          })}
        </ul>
      ) : null}

      {scheduledSubjects.length > 0 ? (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold">Today&apos;s Scheduled Subject</p>
            <p className="text-muted-foreground text-xs">
              Gap / interval class (&gt;15 min break) — shown for reference only. Cannot mark yet.
            </p>
          </div>
          <ul className="space-y-2">
            {scheduledSubjects.map((subject) => {
              const id = subjectId(subject)
              return (
                <li
                  key={`scheduled-${id}`}
                  className="rounded-lg border border-dashed px-3 py-2.5 opacity-80"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{subjectLabel(subject)}</span>
                    <Badge variant="outline" className="text-[10px]">
                      Scheduled
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">{subjectRange(subject)}</p>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {hasSelectable ? (
        <div className="flex flex-wrap gap-2">
          {onCancel ? (
            <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={submitting || selectedIds.length === 0}
            onClick={onSubmit}
          >
            {submitting ? "Saving…" : `Mark selected (${selectedIds.length})`}
          </Button>
        </div>
      ) : onCancel ? (
        <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
          Close
        </Button>
      ) : null}
    </div>
  )
}
