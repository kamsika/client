"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { registerUser } from "@/services/auth"
import type { User } from "@/types"

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Staff Management</CardTitle>
          <CardDescription>Create teacher accounts for your tuition center</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>Add Teacher</DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Teacher Account</DialogTitle>
              <DialogDescription>
                Creates a teacher login linked to your center. Share the email and password with the
                staff member.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teacher-name">Name</Label>
                <Input
                  id="teacher-name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Teacher full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacher-email">Email</Label>
                <Input
                  id="teacher-email"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="teacher@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacher-password">Password</Label>
                <Input
                  id="teacher-password"
                  type="text"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="At least 6 characters"
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Role is fixed to <span className="font-medium">teacher</span> and linked to your
                center automatically.
              </p>
              <Button
                type="button"
                className="w-full"
                disabled={creating}
                onClick={() => void handleCreateTeacher()}
              >
                {creating ? "Creating..." : "Create Teacher"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3">
        {teachers.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No teachers yet. Add a teacher account to assign classrooms.
          </p>
        ) : (
          teachers.map((teacher) => (
            <div key={teacher.id} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">{teacher.full_name}</p>
                <p className="text-muted-foreground text-sm">{teacher.email}</p>
              </div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Teacher</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
