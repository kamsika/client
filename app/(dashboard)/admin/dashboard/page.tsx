"use client"

import { useEffect, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { DashboardShell } from "@/components/dashboard-shell"
import { LogsTable, StatusBadge } from "@/components/logs-table"
import { Badge } from "@/components/ui/badge"
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
import { registerInstitution } from "@/services/auth"
import { createClassroom, listClassrooms } from "@/services/classroom"
import { listInstitutions, updateInstitutionStatus } from "@/services/institution"
import { listSmsLogs } from "@/services/sms-log"
import { listStudents, listTeachers } from "@/services/student"
import type { Classroom, Institution, SmsLog, User } from "@/types"

const adminNav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/students/import", label: "Import Students" },
]

export default function AdminDashboardPage() {
  const user = getStoredUser<User>()
  const isSuperAdmin = user?.role === "super_admin"
  const allowedRoles = isSuperAdmin ? ["super_admin"] : ["institution_admin"]

  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<{ id: number; full_name: string | null; registration_no: string }[]>([])
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([])
  const [teachers, setTeachers] = useState<User[]>([])
  const [open, setOpen] = useState(false)
  const [institutionOpen, setInstitutionOpen] = useState(false)
  const [form, setForm] = useState({ name: "", schedule_start_time: "09:00", teacher_id: "" })
  const [institutionForm, setInstitutionForm] = useState({
    name: "",
    subdomain: "",
    admin_name: "",
    admin_email: "",
    admin_password: "",
    admin_phone: "",
  })
  const [creatingInstitution, setCreatingInstitution] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      if (isSuperAdmin) {
        const inst = await listInstitutions()
        setInstitutions(inst)
      }
      const [cls, std, logs, tch] = await Promise.all([
        listClassrooms(),
        listStudents(),
        listSmsLogs(),
        listTeachers().catch(() => []),
      ])
      setClassrooms(cls)
      setStudents(std)
      setSmsLogs(logs.slice(0, 10))
      setTeachers(tch)
    } catch {
      toast.error("Failed to load dashboard data")
    }
  }

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
      loadData()
    } catch {
      toast.error("Failed to create classroom")
    }
  }

  async function toggleStatus(id: number, status: "Active" | "Suspended") {
    try {
      await updateInstitutionStatus(id, status)
      toast.success("Institution status updated")
      loadData()
    } catch {
      toast.error("Failed to update status")
    }
  }

  async function handleCreateInstitution() {
    const { name, subdomain, admin_name, admin_email, admin_password } = institutionForm
    if (!name || !subdomain || !admin_name || !admin_email || !admin_password) {
      toast.error("Fill all required institution fields")
      return
    }
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      toast.error("Subdomain must be lowercase letters, numbers, and hyphens only")
      return
    }
    setCreatingInstitution(true)
    try {
      await registerInstitution({
        name,
        subdomain,
        admin_name,
        admin_email,
        admin_password,
        admin_phone: institutionForm.admin_phone || undefined,
      })
      toast.success("Institution created successfully")
      setInstitutionOpen(false)
      setInstitutionForm({
        name: "",
        subdomain: "",
        admin_name: "",
        admin_email: "",
        admin_password: "",
        admin_phone: "",
      })
      loadData()
    } catch {
      toast.error("Failed to create institution. Subdomain or email may already exist.")
    } finally {
      setCreatingInstitution(false)
    }
  }

  const smsColumns: ColumnDef<SmsLog>[] = [
    { accessorKey: "sent_at", header: "Sent At", cell: ({ row }) => new Date(row.original.sent_at).toLocaleString() },
    { accessorKey: "recipient_phone", header: "Phone" },
    { accessorKey: "message_body", header: "Message" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ]

  return (
    <DashboardShell title="Admin Dashboard" navItems={adminNav} allowedRoles={allowedRoles}>
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
              <CardDescription>SMS Sent (Recent)</CardDescription>
              <CardTitle className="text-3xl">{smsLogs.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {isSuperAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Institutions</CardTitle>
                <CardDescription>Manage tenant activation and status</CardDescription>
              </div>
              <Dialog open={institutionOpen} onOpenChange={setInstitutionOpen}>
                <DialogTrigger render={<Button />}>Create Institution</DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>New Institution</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Institution Name</Label>
                      <Input
                        value={institutionForm.name}
                        onChange={(e) => setInstitutionForm({ ...institutionForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subdomain</Label>
                      <Input
                        placeholder="my-center"
                        value={institutionForm.subdomain}
                        onChange={(e) =>
                          setInstitutionForm({ ...institutionForm, subdomain: e.target.value.toLowerCase() })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Admin Full Name</Label>
                      <Input
                        value={institutionForm.admin_name}
                        onChange={(e) => setInstitutionForm({ ...institutionForm, admin_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Admin Email</Label>
                      <Input
                        type="email"
                        value={institutionForm.admin_email}
                        onChange={(e) => setInstitutionForm({ ...institutionForm, admin_email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Admin Phone (optional)</Label>
                      <Input
                        value={institutionForm.admin_phone}
                        onChange={(e) => setInstitutionForm({ ...institutionForm, admin_phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Admin Password</Label>
                      <Input
                        type="password"
                        value={institutionForm.admin_password}
                        onChange={(e) => setInstitutionForm({ ...institutionForm, admin_password: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleCreateInstitution} disabled={creatingInstitution}>
                      {creatingInstitution ? "Creating..." : "Create Institution"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {institutions.length === 0 && (
                <p className="text-muted-foreground text-sm">No institutions yet. Create one to get started.</p>
              )}
              {institutions.map((inst) => (
                <div key={inst.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{inst.name}</p>
                    <p className="text-muted-foreground text-sm">{inst.subdomain}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={inst.status === "Active" ? "default" : "destructive"}>{inst.status}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleStatus(inst.id, inst.status === "Active" ? "Suspended" : "Active")}
                    >
                      Toggle
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {!isSuperAdmin && (
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
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
                      <Select value={form.teacher_id} onValueChange={(v) => v && setForm({ ...form, teacher_id: v })}>
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
                    <Button onClick={handleCreateClassroom}>Create</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {classrooms.map((cls) => (
                <div key={cls.id} className="flex items-center justify-between rounded-lg border p-4">
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
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent SMS Logs</CardTitle>
            <CardDescription>Delivery audit trail</CardDescription>
          </CardHeader>
          <CardContent>
            <LogsTable data={smsLogs} columns={smsColumns} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
