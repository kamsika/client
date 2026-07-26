"use client"

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DEFAULT_ENROLLABLE_SUBJECTS } from "@/lib/enrollable-subjects"
import { cn } from "@/lib/utils"

interface EnrolledSubjectsPickerProps {
  value: string[]
  onChange: (subjects: string[]) => void
  options?: string[]
  id?: string
  label?: string
  className?: string
}

export function EnrolledSubjectsPicker({
  value,
  onChange,
  options,
  id = "enrolled-subjects",
  label = "Enrolled Subjects",
  className,
}: EnrolledSubjectsPickerProps) {
  const [customSubject, setCustomSubject] = useState("")

  const choices = useMemo(() => {
    const base = options?.length ? options : [...DEFAULT_ENROLLABLE_SUBJECTS]
    const merged = new Set([...base, ...value])
    return Array.from(merged)
  }, [options, value])

  function toggle(subject: string) {
    const exists = value.some((item) => item.toLowerCase() === subject.toLowerCase())
    if (exists) {
      onChange(value.filter((item) => item.toLowerCase() !== subject.toLowerCase()))
      return
    }
    onChange([...value, subject])
  }

  function addCustom() {
    const next = customSubject.trim()
    if (!next) return
    if (!value.some((item) => item.toLowerCase() === next.toLowerCase())) {
      onChange([...value, next])
    }
    setCustomSubject("")
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-muted-foreground text-xs">
          Select the subjects this student is registered for.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {choices.map((subject) => {
          const selected = value.some((item) => item.toLowerCase() === subject.toLowerCase())
          return (
            <button
              key={subject}
              type="button"
              id={subject === choices[0] ? id : undefined}
              aria-pressed={selected}
              onClick={() => toggle(subject)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-foreground hover:bg-muted",
              )}
            >
              {subject}
            </button>
          )
        })}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={customSubject}
          placeholder="Add custom subject"
          className="text-black"
          onChange={(event) => setCustomSubject(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addCustom()
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addCustom}>
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((subject) => (
            <Badge key={subject} variant="secondary">
              {subject}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
