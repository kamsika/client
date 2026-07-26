"use client"

import { useState } from "react"
import { Loader2, Plus, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getApiErrorMessage } from "@/lib/api-errors"
import { cn } from "@/lib/utils"
import { registerUser } from "@/services/auth"
import type { User } from "@/types"

const fieldClass =
  "h-11 border-[#A2D4ED] bg-white transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const primaryBtn =
  "gap-2 bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white"

interface AdminStaffSectionProps {
  teachers: User[]
  onTeacherCreated: (teacher: User) => void
}

export function AdminStaffSection({ teachers, onTeacherCreated }: AdminStaffSectionProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
  })

  async function handleCreateTeacher() {
    const full_name = form.full_name.trim()
    const email = form.email.trim().toLowerCase()
    const password = form.password

    if (!full_name || !email || !password) {
      toast.error("Name, email, and password are required")
      return
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setCreating(true)
    try {
      const data = await registerUser({
        role: "teacher",
        full_name,
        email,
        password,
      })
      toast.success(`Teacher account created for ${data.user.full_name}`)
      onTeacherCreated(data.user)
      setForm({ full_name: "", email: "", password: "" })
      setOpen(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create teacher account"))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]">
      <div className="flex flex-col gap-4 border-b border-[#A2D4ED]/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#05082E]">Staff Management</h2>
          <p className="text-sm text-[#0047AB]/75">Create teacher accounts for your tuition center</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className={cn("h-10", primaryBtn)} />}>
            <Plus className="size-4" />
            Add Teacher
          </DialogTrigger>
          <DialogContent className="border-[#A2D4ED]/40 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#05082E]">New Teacher Account</DialogTitle>
              <DialogDescription>
                Creates a teacher login linked to your center. Share the email and password with the
                staff member.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teacher-name" className="text-[#05082E]">
                  Name
                </Label>
                <Input
                  id="teacher-name"
                  className={fieldClass}
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Teacher full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacher-email" className="text-[#05082E]">
                  Email
                </Label>
                <Input
                  id="teacher-email"
                  className={fieldClass}
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="teacher@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacher-password" className="text-[#05082E]">
                  Password
                </Label>
                <Input
                  id="teacher-password"
                  className={fieldClass}
                  type="text"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="At least 6 characters"
                />
              </div>
              <p className="text-xs text-[#0047AB]/70">
                Role is fixed to <span className="font-medium text-[#05082E]">teacher</span> and
                linked to your center automatically.
              </p>
              <Button
                type="button"
                className={cn("h-11 w-full", primaryBtn)}
                disabled={creating}
                onClick={() => void handleCreateTeacher()}
              >
                {creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create Teacher"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="divide-y divide-[#A2D4ED]/30">
        {teachers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[#A2D4ED]/30 text-[#0047AB]">
              <Users className="size-5" />
            </span>
            <p className="font-medium text-[#05082E]">No teachers yet</p>
            <p className="text-sm text-[#0047AB]/70">
              Add a teacher account to assign classrooms.
            </p>
          </div>
        ) : (
          teachers.map((teacher, index) => (
            <div
              key={teacher.id}
              className={cn(
                "flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-[#A2D4ED]/10",
                index % 2 === 1 && "bg-[#f8fbfe]",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#A2D4ED]/35 text-xs font-bold text-[#0047AB]">
                  {teacher.full_name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#05082E]">{teacher.full_name}</p>
                  <p className="truncate text-sm text-[#0047AB]/75">{teacher.email}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-[#ABD2F2]/40 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[#0047AB] uppercase">
                Teacher
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
