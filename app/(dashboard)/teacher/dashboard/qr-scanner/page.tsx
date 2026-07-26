"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { TeacherLiveQrScanner } from "@/components/teacher-live-qr-scanner"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getApiErrorMessage } from "@/lib/api-errors"
import { cn } from "@/lib/utils"
import { listClassrooms } from "@/services/classroom"
import type { Classroom } from "@/types"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

const fieldClass =
  "h-10 border-[#A2D4ED] bg-white transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

export default function TeacherQrScannerPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [classroomId, setClassroomId] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const items = await listClassrooms()
        if (cancelled) return
        setClassrooms(items)
        if (items.length === 1) {
          setClassroomId(String(items[0].id))
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getApiErrorMessage(error, "Failed to load classrooms"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const selected = classrooms.find((item) => String(item.id) === classroomId) ?? null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[#05082E]">QR Scanner</h2>
        <p className="text-sm text-[#0047AB]/75">
          Select a classroom/grade, scan a student QR, review their details and enrolled
          subjects, then mark attendance as Present.
        </p>
      </div>

      <div className={cn(cardShell, "p-5")}>
        <div className="max-w-md space-y-2">
          <Label htmlFor="checker-classroom" className="text-[#05082E]">
            Classroom / Grade
          </Label>
          <Select
            value={classroomId || null}
            onValueChange={(value) => value && setClassroomId(value)}
            disabled={loading || classrooms.length === 0}
          >
            <SelectTrigger id="checker-classroom" className={cn(fieldClass, "w-full")}>
              <SelectValue
                placeholder={loading ? "Loading classrooms…" : "Select classroom"}
              />
            </SelectTrigger>
            <SelectContent>
              {classrooms.map((classroom) => (
                <SelectItem key={classroom.id} value={String(classroom.id)}>
                  {classroom.grade
                    ? `${classroom.name} (${classroom.grade})`
                    : classroom.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!loading && classrooms.length === 0 ? (
            <p className="text-sm text-[#0047AB]/70">
              No classrooms yet. Ask your center admin to create one.
            </p>
          ) : null}
          {selected ? (
            <p className="text-xs text-[#0047AB]/70">
              Scanning for{" "}
              <span className="font-medium text-[#05082E]">
                {selected.name}
                {selected.grade ? ` · ${selected.grade}` : ""}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <div className={cn(cardShell, "overflow-hidden p-5")}>
        {classroomId ? (
          <TeacherLiveQrScanner key={classroomId} classroomId={Number(classroomId)} />
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#A2D4ED]/60 bg-[#f8fbfe] px-6 text-center text-sm text-[#0047AB]/75">
            <p className="font-medium text-[#05082E]">Camera preview ready</p>
            <p>Select a classroom above to open the QR scanner.</p>
          </div>
        )}
      </div>
    </div>
  )
}
