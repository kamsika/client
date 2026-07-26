"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { DashboardShell } from "@/components/dashboard-shell"
import { SuperAdminDashboard } from "@/components/super-admin-dashboard"
import { AdminAddStudentForm } from "@/components/admin-add-student-form"
import { AdminStaffSection } from "@/components/admin-staff-section"
import { AdminStudentsSection } from "@/components/admin-students-section"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { getStoredUser } from "@/lib/api-client"
import { getAdminNav } from "@/lib/admin-nav"
import { createClassroom, listClassrooms } from "@/services/classroom"
import { listSmsLogs } from "@/services/sms-log"
import { listStudents, listTeachers } from "@/services/student"
import type { Classroom, SmsLog, Student, User } from "@/types"

export default function AdminDashboardPage() {
  const user = getStoredUser<User>()
  if (user?.role === "super_admin") {
    return <SuperAdminDashboard />
  }
  return <InstitutionAdminDashboard />
}

function InstitutionAdminDashboard() {
  const allowedRoles = ["super_admin", "institution_admin"]

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([])
  const [teachers, setTeachers] = useState<User[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: "", schedule_start_time: "09:00", teacher_id: "" })

  const loadData = useCallback(async () => {
    try {
      setLoadingStudents(true)
      const [cls, std, logs, tch] = await Promise.all([
        listClassrooms(),
        listStudents(),
        listSmsLogs(),
        listTeachers().catch(() => []),
      ])
      setClassrooms(cls)
      setStudents(std)
      setSmsLogs(logs)
      setTeachers(tch)
    } catch {
      toast.error("Failed to load dashboard data")
    } finally {
      setLoadingStudents(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleCreateClassroom() {
    if (!form.name || !form.teacher_id) {
      toast.error("Fill all classroom fields")
      return
    }
    try {
      await createClassroom({
        name: form.name,
        schedule_start_time: form.schedule_start_time,
        teacher_id: Number(form.teacher_id),
      })
      toast.success("Classroom created")
      setOpen(false)
      setForm({ name: "", schedule_start_time: "09:00", teacher_id: "" })
      void loadData()
    } catch {
      toast.error("Failed to create classroom")
    }
  }

  return (
    <DashboardShell
      title="Admin Dashboard"
      navItems={getAdminNav(false)}
      allowedRoles={allowedRoles}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Classrooms</CardDescription>
              <CardTitle className="text-3xl">{classrooms.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Students</CardDescription>
              <CardTitle className="text-3xl">{students.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>SMS Sent</CardDescription>
              <CardTitle className="text-3xl">{smsLogs.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <AdminStaffSection
          teachers={teachers}
          onTeacherCreated={(teacher) => setTeachers((current) => [...current, teacher])}
        />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Classrooms</CardTitle>
              <CardDescription>Create and manage scheduled classes</CardDescription>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button />}>Create Classroom</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Classroom</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Schedule Start Time</Label>
                    <Input
                      type="time"
                      value={form.schedule_start_time}
                      onChange={(e) => setForm({ ...form, schedule_start_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teacher</Label>
                    <Select
                      value={form.teacher_id}
                      onValueChange={(v) => v && setForm({ ...form, teacher_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => void handleCreateClassroom()}>Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-3">
            {classrooms.map((cls) => (
              <div
                key={cls.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{cls.name}</p>
                  <p className="text-muted-foreground text-sm">
                    Starts at {cls.schedule_start_time} · {cls.teacher_name}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <AdminAddStudentForm
          existingStudents={students}
          onStudentAdded={(student) => setStudents((current) => [...current, student])}
        />
        <AdminStudentsSection
          students={students}
          loading={loadingStudents}
          onStudentUpdated={(updated) =>
            setStudents((current) =>
              current.map((student) => (student.id === updated.id ? updated : student)),
            )
          }
        />
      </div>
    </DashboardShell>
  )
}
