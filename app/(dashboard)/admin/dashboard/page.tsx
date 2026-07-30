"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  GraduationCap,
  LayoutGrid,
  Pencil,
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
import { CreateClassroomDialog } from "@/components/create-classroom-dialog"
import { getStoredUser } from "@/lib/api-client"
import { getAdminNav } from "@/lib/admin-nav"
import { cn } from "@/lib/utils"
import { listClassrooms } from "@/services/classroom"
import { listStudents, listTeachers } from "@/services/student"
import type { Classroom, Student, User } from "@/types"

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
  const router = useRouter()
  const allowedRoles = ["super_admin", "institution_admin"]

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [teachers, setTeachers] = useState<User[]>([])
  const [editingClassroomId, setEditingClassroomId] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoadingStudents(true)
      const [cls, std, tch] = await Promise.all([
        listClassrooms(),
        listStudents(),
        listTeachers().catch(() => []),
      ])
      setClassrooms(cls)
      setStudents(std)
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
        detail: `${cls.grade ? `${cls.grade} · ` : ""}${cls.teacher_name || "No teacher"}`,
      })),
    [classrooms],
  )

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
              label: "Institution",
              value: "Manage",
              icon: Building2,
              gradient: "from-[#F9BF15]/20 via-white to-white",
              iconWrap: "bg-[#F9BF15]/25 text-[#E88D1D]",
              navigateTo: "/admin/institution",
            },
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
          ].map((card) => {
            const CardTag = card.navigateTo ? "button" : "div"
            return (
            <CardTag
              key={card.label}
              type={card.navigateTo ? "button" : undefined}
              onClick={card.navigateTo ? () => router.push(card.navigateTo!) : undefined}
              className={cn(
                "rounded-2xl border border-[#A2D4ED]/50 bg-gradient-to-br p-5 text-left shadow-[0_10px_30px_rgba(5,8,46,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(162,212,237,0.25)]",
                card.gradient,
                card.navigateTo && "cursor-pointer",
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
            </CardTag>
            )
          })}
        </div>

        <AdminStaffSection
          teachers={teachers}
          onTeacherCreated={(teacher) => setTeachers((current) => [...current, teacher])}
        />

        <div className={cn(cardShell, "overflow-hidden")}>
          <div className="flex flex-col gap-4 border-b border-[#A2D4ED]/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#05082E]">Classrooms</h2>
              <p className="text-sm text-[#0047AB]/75">
                Create grade classrooms with subject teachers and weekly timetables
              </p>
            </div>
            <CreateClassroomDialog
              teachers={teachers}
              onCreated={(classroom) => {
                setClassrooms((current) =>
                  [...current, classroom].sort((a, b) => a.name.localeCompare(b.name)),
                )
              }}
            />
            {editingClassroomId != null ? (
              <CreateClassroomDialog
                teachers={teachers}
                editClassroomId={editingClassroomId}
                open
                onOpenChange={(next) => {
                  if (!next) setEditingClassroomId(null)
                }}
                onUpdated={(classroom) => {
                  setClassrooms((current) =>
                    current
                      .map((item) =>
                        item.id === classroom.id ? { ...item, ...classroom } : item,
                      )
                      .sort((a, b) => a.name.localeCompare(b.name)),
                  )
                  setEditingClassroomId(null)
                }}
              />
            ) : null}
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
                        {cls.grade ? `${cls.grade} · ` : ""}
                        {cls.teacher_name || "No primary teacher"}
                        {cls.subject_teachers?.length
                          ? ` · ${cls.subject_teachers.length} subject${cls.subject_teachers.length === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5 border-[#A2D4ED] text-[#0047AB] hover:bg-[#ABD2F2]/40"
                    onClick={() => setEditingClassroomId(cls.id)}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
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
