"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  GraduationCap,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Plus,
  School,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { SuperAdminDashboard } from "@/components/super-admin-dashboard"
import { InstitutionAdminShell } from "@/components/institution-admin-shell"
import { AdminAddStudentForm } from "@/components/admin-add-student-form"
import { AdminStaffSection } from "@/components/admin-staff-section"
import { AdminStudentsSection } from "@/components/admin-students-section"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getStoredUser } from "@/lib/api-client"
import { getAdminNav } from "@/lib/admin-nav"
import { cn } from "@/lib/utils"
import { createClassroom, listClassrooms } from "@/services/classroom"
import { listSmsLogs } from "@/services/sms-log"
import { listStudents, listTeachers } from "@/services/student"
import type { Classroom, SmsLog, Student, User } from "@/types"

const fieldClass =
  "h-11 border-[#A2D4ED] bg-white transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const primaryBtn =
  "gap-2 bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

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
  const [creatingClassroom, setCreatingClassroom] = useState(false)
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

  const notificationItems = useMemo(
    () =>
      classrooms.slice(0, 5).map((cls) => ({
        id: String(cls.id),
        title: cls.name,
        detail: `Starts at ${cls.schedule_start_time}${cls.teacher_name ? ` · ${cls.teacher_name}` : ""}`,
      })),
    [classrooms],
  )

  async function handleCreateClassroom() {
    if (!form.name || !form.teacher_id) {
      toast.error("Fill all classroom fields")
      return
    }
    setCreatingClassroom(true)
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
    } finally {
      setCreatingClassroom(false)
    }
  }

  return (
    <InstitutionAdminShell
      title="Dashboard"
      description="Overview of classrooms, students, and staff"
      navItems={getAdminNav(false)}
      allowedRoles={allowedRoles}
      notificationItems={notificationItems}
    >
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Classrooms",
              value: classrooms.length,
              icon: LayoutGrid,
              gradient: "from-[#ABD2F2]/50 via-white to-white",
              iconWrap: "bg-[#A2D4ED]/50 text-[#0047AB]",
            },
            {
              label: "Students",
              value: students.length,
              icon: GraduationCap,
              gradient: "from-[#A2D4ED]/55 via-white to-white",
              iconWrap: "bg-[#A2D4ED] text-[#0047AB]",
            },
            {
              label: "Teachers",
              value: teachers.length,
              icon: Users,
              gradient: "from-[#F9BF15]/20 via-white to-white",
              iconWrap: "bg-[#F9BF15]/25 text-[#E88D1D]",
            },
            {
              label: "SMS Sent",
              value: smsLogs.length,
              icon: MessageSquare,
              gradient: "from-[#ABD2F2]/40 via-white to-white",
              iconWrap: "bg-[#ABD2F2]/60 text-[#0047AB]",
            },
          ].map((card) => (
            <div
              key={card.label}
              className={cn(
                "rounded-2xl border border-[#A2D4ED]/50 bg-gradient-to-br p-5 shadow-[0_10px_30px_rgba(5,8,46,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(162,212,237,0.25)]",
                card.gradient,
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#0047AB]">{card.label}</p>
                <span
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-xl",
                    card.iconWrap,
                  )}
                >
                  <card.icon className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-[#05082E]">
                {loadingStudents && card.label === "Students" ? "—" : card.value}
              </p>
            </div>
          ))}
        </div>

        <AdminStaffSection
          teachers={teachers}
          onTeacherCreated={(teacher) => setTeachers((current) => [...current, teacher])}
        />

        <div className={cn(cardShell, "overflow-hidden")}>
          <div className="flex flex-col gap-4 border-b border-[#A2D4ED]/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#05082E]">Classrooms</h2>
              <p className="text-sm text-[#0047AB]/75">Create and manage scheduled classes</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button className={cn("h-10", primaryBtn)} />}>
                <Plus className="size-4" />
                Create Classroom
              </DialogTrigger>
              <DialogContent className="border-[#A2D4ED]/40 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-[#05082E]">New Classroom</DialogTitle>
                  <DialogDescription>
                    Assign a teacher and schedule start time for this class.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[#05082E]">Name</Label>
                    <Input
                      className={fieldClass}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#05082E]">Schedule Start Time</Label>
                    <Input
                      className={fieldClass}
                      type="time"
                      value={form.schedule_start_time}
                      onChange={(e) => setForm({ ...form, schedule_start_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#05082E]">Teacher</Label>
                    <Select
                      value={form.teacher_id}
                      onValueChange={(v) => v && setForm({ ...form, teacher_id: v })}
                    >
                      <SelectTrigger className={cn(fieldClass, "w-full")}>
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
                  <Button
                    className={cn("h-11 w-full", primaryBtn)}
                    onClick={() => void handleCreateClassroom()}
                    disabled={creatingClassroom}
                  >
                    {creatingClassroom ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      "Create Classroom"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="divide-y divide-[#A2D4ED]/30">
            {classrooms.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[#A2D4ED]/30 text-[#0047AB]">
                  <School className="size-5" />
                </span>
                <p className="font-medium text-[#05082E]">No classrooms yet</p>
                <p className="text-sm text-[#0047AB]/70">Create a classroom to get started.</p>
              </div>
            ) : (
              classrooms.map((cls, index) => (
                <div
                  key={cls.id}
                  className={cn(
                    "flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-[#A2D4ED]/10",
                    index % 2 === 1 && "bg-[#f8fbfe]",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#A2D4ED]/35 text-xs font-bold text-[#0047AB]">
                      {cls.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#05082E]">{cls.name}</p>
                      <p className="text-sm text-[#0047AB]/75">
                        Starts at {cls.schedule_start_time}
                        {cls.teacher_name ? ` · ${cls.teacher_name}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

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
    </InstitutionAdminShell>
  )
}
