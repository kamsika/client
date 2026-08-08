"use client"

import { useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getApiErrorMessage } from "@/lib/api-errors"
import { selectItems } from "@/lib/select-items"
import { cn } from "@/lib/utils"
import { createSubject } from "@/services/subject"
import type { Subject, User } from "@/types"

const fieldClass =
  "h-10 border-[#A2D4ED] bg-white transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const primaryBtn =
  "gap-2 bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white"

const ADD_NEW_VALUE = "__add_new_subject__"

interface SubjectSelectProps {
  value?: string | null
  onValueChange: (subjectName: string, subject?: Subject) => void
  subjects: Subject[]
  onSubjectCreated: (subject: Subject) => void
  teachers?: User[]
  placeholder?: string
  className?: string
  triggerClassName?: string
  allowAdd?: boolean
  disabled?: boolean
}

export function SubjectSelect({
  value,
  onValueChange,
  subjects,
  onSubjectCreated,
  teachers = [],
  placeholder = "Select subject",
  className,
  triggerClassName,
  allowAdd = true,
  disabled = false,
}: SubjectSelectProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [teacherId, setTeacherId] = useState("")
  const [monthlyFee, setMonthlyFee] = useState("")
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 7) + "-01")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")

  function resetAddForm() {
    setName("")
    setCode("")
    setTeacherId("")
    setMonthlyFee("")
    setEffectiveFrom(new Date().toISOString().slice(0, 7) + "-01")
    setDescription("")
    setError("")
  }

  async function handleSaveSubject() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Subject name is required")
      return
    }
    if (monthlyFee.trim() && (!Number.isFinite(Number(monthlyFee)) || Number(monthlyFee) < 0)) {
      setError("Enter a valid monthly fee")
      return
    }

    setSaving(true)
    setError("")
    try {
      const subject = await createSubject({
        name: trimmed,
        code: code.trim() || undefined,
        teacher_id: teacherId ? Number(teacherId) : undefined,
        description: description.trim() || undefined,
        monthly_fee: monthlyFee.trim() ? Number(monthlyFee) : undefined,
        effective_from: effectiveFrom,
      })
      onSubjectCreated(subject)
      onValueChange(subject.name, subject)
      toast.success(`Subject "${subject.name}" added`)
      setAddOpen(false)
      resetAddForm()
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create subject"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={className}>
      <Select
        value={value || null}
        disabled={disabled}
        onValueChange={(next) => {
          if (!next) return
          if (next === ADD_NEW_VALUE) {
            setAddOpen(true)
            return
          }
          const match = subjects.find((item) => item.name === next)
          onValueChange(next, match)
        }}
        items={selectItems([
          ...subjects.map((subject) => ({
            value: subject.name,
            label: subject.code ? `${subject.name} (${subject.code})` : subject.name,
          })),
          ...(allowAdd ? [{ value: ADD_NEW_VALUE, label: "Add New Subject" }] : []),
        ])}
      >
        <SelectTrigger className={cn(fieldClass, "w-full", triggerClassName)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {subjects.map((subject) => (
            <SelectItem key={subject.id} value={subject.name}>
              {subject.code ? `${subject.name} (${subject.code})` : subject.name}
            </SelectItem>
          ))}
          {allowAdd ? (
            <SelectItem value={ADD_NEW_VALUE} className="text-[#0047AB] font-medium">
              <span className="inline-flex items-center gap-1.5">
                <Plus className="size-3.5" />
                Add New Subject
              </span>
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>

      {addOpen ? (
        <Dialog
          open
          onOpenChange={(nextOpen) => {
            setAddOpen(nextOpen)
            if (!nextOpen) resetAddForm()
          }}
        >
          <DialogContent className="border-[#A2D4ED]/40 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#05082E]">Add New Subject</DialogTitle>
              <DialogDescription>
                Create a subject for your center. It will appear in the dropdown immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[#05082E]">Subject Name</Label>
                <Input
                  className={cn(fieldClass, error && "border-destructive")}
                  placeholder="e.g. Tamil"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#05082E]">Monthly Fee (LKR, optional)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className={fieldClass}
                  placeholder="e.g. 2000"
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#05082E]">Fee effective from</Label>
                <Input type="date" className={fieldClass} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[#05082E]">Description (optional)</Label>
                <Input className={fieldClass} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[#05082E]">Subject Code (optional)</Label>
                <Input
                  className={fieldClass}
                  placeholder="e.g. TAM-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              {teachers.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-[#05082E]">Assign Teacher (optional)</Label>
                  <Select
                    value={teacherId || null}
                    onValueChange={(next) => next && setTeacherId(next)}
                    items={selectItems(
                      teachers.map((teacher) => ({
                        value: teacher.id,
                        label: teacher.full_name || `Teacher #${teacher.id}`,
                      })),
                    )}
                  >
                    <SelectTrigger className={cn(fieldClass, "w-full")}>
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={String(teacher.id)}>
                          {teacher.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <Button
                type="button"
                className={cn("h-11 w-full", primaryBtn)}
                disabled={saving}
                onClick={() => void handleSaveSubject()}
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Subject"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
