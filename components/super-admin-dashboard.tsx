"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Building2,
  CheckCircle2,
  Copy,
  Plus,
  Search,
  ShieldOff,
} from "lucide-react"
import { toast } from "sonner"

import { SuperAdminShell } from "@/components/super-admin-shell"
import { Badge } from "@/components/ui/badge"
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
  createInstitution,
  listInstitutions,
  updateInstitutionStatus,
  type InstitutionAdminCredentials,
} from "@/services/institution"
import type { Institution } from "@/types"

export function SuperAdminDashboard() {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [institutionOpen, setInstitutionOpen] = useState(false)
  const [credentialsOpen, setCredentialsOpen] = useState(false)
  const [creatingInstitution, setCreatingInstitution] = useState(false)
  const [createdCredentials, setCreatedCredentials] =
    useState<InstitutionAdminCredentials | null>(null)
  const [institutionForm, setInstitutionForm] = useState({
    name: "",
    subdomain: "",
    admin_name: "",
    admin_email: "",
    admin_phone: "",
  })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const inst = await listInstitutions()
      setInstitutions(inst)
    } catch {
      toast.error("Failed to load institutions")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const stats = useMemo(() => {
    const active = institutions.filter((item) => item.status === "Active").length
    const suspended = institutions.filter((item) => item.status === "Suspended").length
    return {
      total: institutions.length,
      active,
      suspended,
    }
  }, [institutions])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return institutions
    return institutions.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.subdomain.toLowerCase().includes(q),
    )
  }, [institutions, search])

  async function toggleStatus(id: number, status: "Active" | "Suspended") {
    try {
      await updateInstitutionStatus(id, status)
      toast.success("Institution status updated")
      void loadData()
    } catch {
      toast.error("Failed to update status")
    }
  }

  async function handleCreateInstitution() {
    const { name, subdomain, admin_name, admin_email, admin_phone } = institutionForm
    if (!name || !subdomain) {
      toast.error("Institution name and subdomain are required")
      return
    }
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      toast.error("Subdomain must be lowercase letters, numbers, and hyphens only")
      return
    }
    setCreatingInstitution(true)
    try {
      const result = await createInstitution({
        name,
        subdomain,
        admin_name: admin_name || undefined,
        admin_email: admin_email || undefined,
        admin_phone: admin_phone || undefined,
      })
      toast.success("Institution and admin account created")
      setInstitutionOpen(false)
      setInstitutionForm({
        name: "",
        subdomain: "",
        admin_name: "",
        admin_email: "",
        admin_phone: "",
      })
      setCreatedCredentials(result.admin_credentials)
      setCredentialsOpen(true)
      void loadData()
    } catch {
      toast.error("Failed to create institution. Subdomain or email may already exist.")
    } finally {
      setCreatingInstitution(false)
    }
  }

  async function copyCredentials() {
    if (!createdCredentials) return
    const text = [
      `Login email: ${createdCredentials.email}`,
      `Password: ${createdCredentials.password}`,
      `Role: Institution Admin`,
      `Institution ID: ${createdCredentials.institution_id}`,
    ].join("\n")
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Credentials copied to clipboard")
    } catch {
      toast.error("Failed to copy credentials")
    }
  }

  return (
    <SuperAdminShell
      title="Institutions"
      description="Create centers, activate tenants, and manage platform access"
    >
      <Dialog open={credentialsOpen} onOpenChange={setCredentialsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Institution Admin Login</DialogTitle>
            <DialogDescription>
              Share these credentials with the tuition center owner. The password is shown only
              once.
            </DialogDescription>
          </DialogHeader>
          {createdCredentials && (
            <div className="space-y-3 rounded-xl border bg-muted/40 p-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Email</p>
                <p className="font-mono font-medium">{createdCredentials.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Password</p>
                <p className="font-mono font-medium">{createdCredentials.password}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Name</p>
                <p>{createdCredentials.full_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Institution ID</p>
                <p className="font-mono">{createdCredentials.institution_id}</p>
              </div>
            </div>
          )}
          <Button type="button" className="w-full gap-2" onClick={() => void copyCredentials()}>
            <Copy className="size-4" />
            Copy Credentials
          </Button>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#00AAE4]/20 bg-white p-5 shadow-sm dark:border-sky-400/15 dark:bg-[#0a0e3d]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#0047AB] dark:text-sky-200/70">
                Total institutions
              </p>
              <Building2 className="size-4 text-[#00AAE4]" />
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-[#05082E] tabular-nums dark:text-white">
              {stats.total}
            </p>
          </div>
          <div className="rounded-2xl border border-[#00AAE4]/20 bg-white p-5 shadow-sm dark:border-sky-400/15 dark:bg-[#0a0e3d]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#0047AB] dark:text-sky-200/70">Active</p>
              <CheckCircle2 className="size-4 text-[#00AAE4]" />
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-[#00AAE4] tabular-nums">
              {stats.active}
            </p>
          </div>
          <div className="rounded-2xl border border-[#F9BF15]/30 bg-white p-5 shadow-sm dark:border-amber-400/20 dark:bg-[#0a0e3d]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#0047AB] dark:text-sky-200/70">Suspended</p>
              <ShieldOff className="size-4 text-[#E88D1D]" />
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-[#E88D1D] tabular-nums">
              {stats.suspended}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#00AAE4]/15 bg-white shadow-sm dark:border-sky-400/10 dark:bg-[#0a0e3d]">
          <div className="flex flex-col gap-4 border-b border-[#00AAE4]/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-sky-400/10">
            <div>
              <h2 className="text-base font-semibold text-[#05082E] dark:text-white">
                All institutions
              </h2>
              <p className="text-sm text-[#0047AB]/80 dark:text-sky-200/60">
                Toggle activation or onboard a new tuition center
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[#00AAE4]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or subdomain…"
                  className="w-full border-[#00AAE4]/25 pl-8 focus-visible:border-[#00AAE4] focus-visible:ring-[#00AAE4]/30 sm:w-64"
                />
              </div>
              <Dialog open={institutionOpen} onOpenChange={setInstitutionOpen}>
                <DialogTrigger
                  render={
                    <Button className="gap-2 bg-[#F9BF15] font-semibold text-[#05082E] hover:bg-[#E88D1D] hover:text-white" />
                  }
                >
                  <Plus className="size-4" />
                  Create Institution
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>New Institution</DialogTitle>
                    <DialogDescription>
                      Creates the center and a default institution admin account.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Institution Name</Label>
                      <Input
                        value={institutionForm.name}
                        onChange={(e) =>
                          setInstitutionForm({ ...institutionForm, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subdomain</Label>
                      <Input
                        placeholder="my-center"
                        value={institutionForm.subdomain}
                        onChange={(e) =>
                          setInstitutionForm({
                            ...institutionForm,
                            subdomain: e.target.value.toLowerCase(),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Admin Full Name (optional)</Label>
                      <Input
                        placeholder="Defaults to '[Institution Name] Admin'"
                        value={institutionForm.admin_name}
                        onChange={(e) =>
                          setInstitutionForm({ ...institutionForm, admin_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Admin Email (optional)</Label>
                      <Input
                        type="email"
                        placeholder="Auto-generated if left blank"
                        value={institutionForm.admin_email}
                        onChange={(e) =>
                          setInstitutionForm({ ...institutionForm, admin_email: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Admin Phone (optional)</Label>
                      <Input
                        value={institutionForm.admin_phone}
                        onChange={(e) =>
                          setInstitutionForm({ ...institutionForm, admin_phone: e.target.value })
                        }
                      />
                    </div>
                    <Button
                      className="w-full bg-[#F9BF15] font-semibold text-[#05082E] hover:bg-[#E88D1D] hover:text-white"
                      onClick={() => void handleCreateInstitution()}
                      disabled={creatingInstitution}
                    >
                      {creatingInstitution ? "Creating…" : "Create Institution"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="divide-y divide-[#00AAE4]/10 dark:divide-sky-400/10">
            {loading ? (
              <p className="px-5 py-10 text-center text-sm text-[#0047AB]/70 dark:text-sky-200/60">
                Loading institutions…
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[#0047AB]/70 dark:text-sky-200/60">
                {search
                  ? "No institutions match your search."
                  : "No institutions yet. Create one to get started."}
              </p>
            ) : (
              filtered.map((inst) => (
                <div
                  key={inst.id}
                  className="flex flex-col gap-3 px-5 py-4 transition hover:bg-[#00AAE4]/5 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-[#0047AB]/20"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0047AB]/10 text-sm font-bold text-[#0047AB] dark:bg-[#00AAE4]/15 dark:text-[#7DDCF5]">
                      {inst.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#05082E] dark:text-white">
                        {inst.name}
                      </p>
                      <p className="truncate text-sm text-[#0047AB]/80 dark:text-sky-200/60">
                        {inst.subdomain}
                        <span className="mx-1.5 text-[#00AAE4]/40">·</span>
                        ID #{inst.id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Badge
                      variant={inst.status === "Active" ? "default" : "destructive"}
                      className={
                        inst.status === "Active"
                          ? "border-0 bg-[#00AAE4]/15 text-[#0047AB] dark:text-[#7DDCF5]"
                          : "border-0 bg-[#E88D1D]/15 text-[#E88D1D]"
                      }
                    >
                      {inst.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#00AAE4]/30 text-[#0047AB] hover:bg-[#00AAE4]/10 dark:text-sky-100"
                      onClick={() =>
                        void toggleStatus(
                          inst.id,
                          inst.status === "Active" ? "Suspended" : "Active",
                        )
                      }
                    >
                      {inst.status === "Active" ? "Suspend" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </SuperAdminShell>
  )
}
