"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldOff,
  Sparkles,
} from "lucide-react"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getApiErrorMessage } from "@/lib/api-errors"
import { buildTenantUrl } from "@/lib/tenant"
import { cn } from "@/lib/utils"
import {
  createInstitution,
  listInstitutions,
  updateInstitutionStatus,
  type InstitutionAdminCredentials,
} from "@/services/institution"
import type { Institution } from "@/types"

const fieldClass =
  "h-11 border-[#A2D4ED] transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const primaryBtn =
  "gap-2 bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white"

const outlineBtn =
  "border-[#A2D4ED] text-[#0047AB] transition hover:bg-[#ABD2F2]/40"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

const CHART_COLORS = {
  active: "#A2D4ED",
  suspended: "#E88D1D",
  navy: "#0047AB",
  gold: "#F9BF15",
  soft: "#ABD2F2",
}

const PAGE_SIZE = 8

type StatusFilter = "all" | "Active" | "Suspended"

/** Subdomain rules mirrored from the backend so errors surface before submit. */
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "superadmin",
  "super-admin",
  "dashboard",
  "auth",
  "login",
  "static",
  "assets",
  "cdn",
  "mail",
  "test",
  "staging",
  "preview",
  "localhost",
])

function validateSubdomainInput(value: string): string | null {
  const subdomain = value.trim().toLowerCase()
  if (!subdomain) return "Subdomain is required"
  if (/\s/.test(subdomain)) return "Subdomain cannot contain spaces"
  if (subdomain.length < 2) return "Subdomain must be at least 2 characters"
  if (subdomain.length > 63) return "Subdomain must be 63 characters or fewer"
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(subdomain)) {
    return "Use lowercase letters, numbers, and hyphens only (cannot start or end with a hyphen)"
  }
  if (subdomain.includes("--")) return "Subdomain cannot contain consecutive hyphens"
  if (RESERVED_SUBDOMAINS.has(subdomain)) return "This subdomain is reserved. Choose another one."
  return null
}

function formatWhen(value?: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-[#A2D4ED]/10",
        className,
      )}
    />
  )
}

export function SuperAdminDashboard() {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [page, setPage] = useState(1)
  const [institutionOpen, setInstitutionOpen] = useState(false)
  const [credentialsOpen, setCredentialsOpen] = useState(false)
  const [creatingInstitution, setCreatingInstitution] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [formErrors, setFormErrors] = useState<{ name?: string; subdomain?: string }>({})
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
    return { total: institutions.length, active, suspended }
  }, [institutions])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return institutions.filter((item) => {
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.subdomain.toLowerCase().includes(q)
      const matchesStatus = statusFilter === "all" || item.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [institutions, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const statusChartData = useMemo(
    () => [
      { name: "Active", value: stats.active, fill: CHART_COLORS.active },
      { name: "Suspended", value: stats.suspended, fill: CHART_COLORS.suspended },
    ],
    [stats.active, stats.suspended],
  )

  const barChartData = useMemo(
    () => [
      { label: "Total", count: stats.total, fill: CHART_COLORS.navy },
      { label: "Active", count: stats.active, fill: CHART_COLORS.active },
      { label: "Suspended", count: stats.suspended, fill: CHART_COLORS.suspended },
    ],
    [stats],
  )

  const recentInstitutions = useMemo(() => {
    return [...institutions]
      .sort((a, b) => {
        const aTime = new Date(a.created_at || 0).getTime()
        const bTime = new Date(b.created_at || 0).getTime()
        return bTime - aTime
      })
      .slice(0, 5)
  }, [institutions])

  const notificationItems = useMemo(
    () =>
      recentInstitutions.map((inst) => ({
        id: String(inst.id),
        title: inst.name,
        detail: `${inst.status} · ${inst.subdomain}`,
        time: formatWhen(inst.created_at),
      })),
    [recentInstitutions],
  )

  async function toggleStatus(id: number, status: "Active" | "Suspended") {
    try {
      setTogglingId(id)
      await updateInstitutionStatus(id, status)
      toast.success("Institution status updated")
      void loadData()
    } catch {
      toast.error("Failed to update status")
    } finally {
      setTogglingId(null)
    }
  }

  async function handleCreateInstitution() {
    const { name, subdomain, admin_name, admin_email, admin_phone } = institutionForm
    const errors: { name?: string; subdomain?: string } = {}
    if (!name) errors.name = "Institution name is required"

    const subdomainError = validateSubdomainInput(subdomain)
    if (subdomainError) errors.subdomain = subdomainError

    const duplicate = institutions.some(
      (item) => item.subdomain.toLowerCase() === subdomain.trim().toLowerCase(),
    )
    if (!errors.subdomain && duplicate) {
      errors.subdomain = "Subdomain already exists"
    }

    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast.error(errors.name || errors.subdomain || "Please fix the form errors")
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
      setFormErrors({})
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
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Failed to create institution. Subdomain or email may already exist.",
        ),
      )
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

  const createDialog = (
    <Dialog
      open={institutionOpen}
      onOpenChange={(open) => {
        setInstitutionOpen(open)
        if (!open) setFormErrors({})
      }}
    >
      <DialogTrigger
        render={<Button className={cn("h-10", primaryBtn)} />}
      >
        <Plus className="size-4" />
        Create Institution
      </DialogTrigger>
      <DialogContent className="border-[#A2D4ED]/20 sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
        <DialogHeader>
          <DialogTitle className="text-[#05082E]">New Institution</DialogTitle>
          <DialogDescription>
            Creates the center and a default institution admin account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#05082E]">Institution Name</Label>
            <Input
              className={cn(fieldClass, formErrors.name && "border-destructive")}
              value={institutionForm.name}
              onChange={(e) => setInstitutionForm({ ...institutionForm, name: e.target.value })}
            />
            {formErrors.name ? (
              <p className="text-destructive text-sm">{formErrors.name}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label className="text-[#05082E]">Subdomain</Label>
            <Input
              className={cn(fieldClass, formErrors.subdomain && "border-destructive")}
              placeholder="my-center"
              value={institutionForm.subdomain}
              onChange={(e) =>
                setInstitutionForm({
                  ...institutionForm,
                  subdomain: e.target.value.toLowerCase().trim(),
                })
              }
            />
            {formErrors.subdomain ? (
              <p className="text-destructive text-sm">{formErrors.subdomain}</p>
            ) : institutionForm.subdomain ? (
              <p className="truncate text-xs text-[#0047AB]/70">
                Dashboard URL:{" "}
                <span className="font-medium text-[#05082E]">
                  {buildTenantUrl(institutionForm.subdomain)}
                </span>
              </p>
            ) : (
              <p className="text-xs text-[#0047AB]/60">
                Lowercase letters, numbers, and hyphens only. Used as the institution&apos;s URL.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-[#05082E]">Admin Full Name (optional)</Label>
            <Input
              className={fieldClass}
              placeholder="Defaults to '[Institution Name] Admin'"
              value={institutionForm.admin_name}
              onChange={(e) =>
                setInstitutionForm({ ...institutionForm, admin_name: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#05082E]">Admin Email (optional)</Label>
            <Input
              className={fieldClass}
              type="email"
              placeholder="Auto-generated if left blank"
              value={institutionForm.admin_email}
              onChange={(e) =>
                setInstitutionForm({ ...institutionForm, admin_email: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#05082E]">Admin Phone (optional)</Label>
            <Input
              className={fieldClass}
              value={institutionForm.admin_phone}
              onChange={(e) =>
                setInstitutionForm({ ...institutionForm, admin_phone: e.target.value })
              }
            />
          </div>
          <Button
            className={cn("h-11 w-full", primaryBtn)}
            onClick={() => void handleCreateInstitution()}
            disabled={creatingInstitution}
          >
            {creatingInstitution ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Institution"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  return (
    <SuperAdminShell
      title="Dashboard"
      description="Platform overview for institutions and tenant status"
      notificationItems={notificationItems}
    >
      <Dialog open={credentialsOpen} onOpenChange={setCredentialsOpen}>
        <DialogContent className="border-[#A2D4ED]/20 sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
          <DialogHeader>
            <DialogTitle className="text-[#05082E]">Institution Admin Login</DialogTitle>
            <DialogDescription>
              Share these credentials with the tuition center owner. The password is shown only
              once.
            </DialogDescription>
          </DialogHeader>
          {createdCredentials && (
            <div className="space-y-3 rounded-xl border border-[#A2D4ED]/15 bg-[#f4f7fb] p-4 text-sm">
              <div>
                <p className="text-xs font-medium text-[#0047AB]/70">Email</p>
                <p className="font-mono font-medium text-[#05082E]">{createdCredentials.email}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#0047AB]/70">Password</p>
                <p className="font-mono font-medium text-[#05082E]">
                  {createdCredentials.password}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#0047AB]/70">Name</p>
                <p className="text-[#05082E]">{createdCredentials.full_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#0047AB]/70">Institution ID</p>
                <p className="font-mono text-[#05082E]">{createdCredentials.institution_id}</p>
              </div>
            </div>
          )}
          <Button
            type="button"
            className={cn("h-11 w-full", primaryBtn)}
            onClick={() => void copyCredentials()}
          >
            <Copy className="size-4" />
            Copy Credentials
          </Button>
        </DialogContent>
      </Dialog>

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* Quick actions */}
        <div
          className={cn(
            cardShell,
            "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#F9BF15]/20 text-[#E88D1D]">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="font-semibold text-[#05082E]">Quick actions</p>
              <p className="text-sm text-[#0047AB]/75">
                Onboard a center or refresh platform tenant data
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {createDialog}
            <Button
              type="button"
              variant="outline"
              className={cn("h-10 gap-2", outlineBtn)}
              disabled={loading}
              onClick={() => void loadData()}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Total institutions",
              value: stats.total,
              icon: Building2,
              gradient: "from-[#ABD2F2]/50 via-white to-white",
              iconWrap: "bg-[#A2D4ED]/50 text-[#0047AB]",
              valueClass: "text-[#05082E]",
            },
            {
              label: "Active",
              value: stats.active,
              icon: CheckCircle2,
              gradient: "from-[#A2D4ED]/55 via-white to-white",
              iconWrap: "bg-[#A2D4ED] text-[#0047AB]",
              valueClass: "text-[#0047AB]",
            },
            {
              label: "Suspended",
              value: stats.suspended,
              icon: ShieldOff,
              gradient: "from-[#F9BF15]/25 via-white to-white",
              iconWrap: "bg-[#F9BF15]/25 text-[#E88D1D]",
              valueClass: "text-[#E88D1D]",
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
                <p className="text-sm font-medium text-[#0047AB]">
                  {card.label}
                </p>
                <span
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-xl",
                    card.iconWrap,
                  )}
                >
                  <card.icon className="size-4" />
                </span>
              </div>
              {loading ? (
                <SkeletonBlock className="mt-3 h-9 w-16" />
              ) : (
                <p
                  className={cn(
                    "mt-3 text-3xl font-bold tracking-tight tabular-nums",
                    card.valueClass,
                  )}
                >
                  {card.value}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Charts + recent activity */}
        <div className="grid gap-4 xl:grid-cols-3">
          <div className={cn(cardShell, "p-5")}>
            <h3 className="text-sm font-semibold text-[#05082E]">
              Status distribution
            </h3>
            <p className="mt-1 text-xs text-[#0047AB]/70">
              Active vs suspended institutions
            </p>
            <div className="mt-4 h-52">
              {loading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <SkeletonBlock className="size-32 rounded-full" />
                </div>
              ) : stats.total === 0 ? (
                <EmptyChart message="No institutions yet" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                    >
                      {statusChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid rgba(162,212,237,0.2)",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 flex justify-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-[#0047AB]">
                <span className="size-2 rounded-full bg-[#A2D4ED]" /> Active
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#0047AB]">
                <span className="size-2 rounded-full bg-[#E88D1D]" /> Suspended
              </span>
            </div>
          </div>

          <div className={cn(cardShell, "p-5")}>
            <h3 className="text-sm font-semibold text-[#05082E]">
              Tenant overview
            </h3>
            <p className="mt-1 text-xs text-[#0047AB]/70">
              Counts by current platform status
            </p>
            <div className="mt-4 h-52">
              {loading ? (
                <div className="flex h-full items-end justify-center gap-3 pb-6">
                  <SkeletonBlock className="h-24 w-10" />
                  <SkeletonBlock className="h-36 w-10" />
                  <SkeletonBlock className="h-16 w-10" />
                </div>
              ) : stats.total === 0 ? (
                <EmptyChart message="No data to chart" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} barSize={28}>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#0047AB", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#0047AB", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(162,212,237,0.06)" }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid rgba(162,212,237,0.2)",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {barChartData.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={cn(cardShell, "p-5")}>
            <h3 className="text-sm font-semibold text-[#05082E]">
              Recent activity
            </h3>
            <p className="mt-1 text-xs text-[#0047AB]/70">
              Latest institutions on the platform
            </p>
            <div className="mt-4 space-y-2.5">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-14 w-full" />
                ))
              ) : recentInstitutions.length === 0 ? (
                <p className="py-10 text-center text-sm text-[#0047AB]/70">No activity yet</p>
              ) : (
                recentInstitutions.map((inst) => (
                  <div
                    key={inst.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#A2D4ED]/10 bg-[#f4f7fb] px-3 py-2.5 transition hover:border-[#A2D4ED]/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#05082E]">
                        {inst.name}
                      </p>
                      <p className="truncate text-[11px] text-[#0047AB]/70">
                        {formatWhen(inst.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={inst.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Institutions table */}
        <div id="institutions" className={cn(cardShell, "scroll-mt-24 overflow-hidden")}>
          <div className="flex flex-col gap-4 border-b border-[#A2D4ED]/10 px-5 py-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#05082E]">
                  All institutions
                </h2>
                <p className="text-sm text-[#0047AB]/80">
                  Search, filter, and manage tenant activation
                </p>
              </div>
              <Button
                type="button"
                className={cn("h-10", primaryBtn)}
                onClick={() => setInstitutionOpen(true)}
              >
                <Plus className="size-4" />
                Create Institution
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#A2D4ED]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or subdomain…"
                  className={cn(fieldClass, "pl-9")}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-[#A2D4ED]" />
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter((value as StatusFilter) || "all")}
                >
                  <SelectTrigger className={cn(fieldClass, "w-[160px]")}>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#f4f7fb] text-[11px] font-semibold tracking-wide text-[#0047AB] uppercase">
                <tr>
                  <th className="px-5 py-3">Institution</th>
                  <th className="px-5 py-3">Subdomain</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0047AB]/10">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      <td className="px-5 py-4" colSpan={5}>
                        <SkeletonBlock className="h-10 w-full" />
                      </td>
                    </tr>
                  ))
                ) : pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[#A2D4ED]/10 text-[#0047AB]">
                          <Building2 className="size-5" />
                        </span>
                        <p className="font-medium text-[#05082E]">
                          {search || statusFilter !== "all"
                            ? "No institutions match your filters"
                            : "No institutions yet"}
                        </p>
                        <p className="text-sm text-[#0047AB]/70">
                          {search || statusFilter !== "all"
                            ? "Try another search or clear the status filter."
                            : "Create an institution to get started."}
                        </p>
                        {!search && statusFilter === "all" ? (
                          <Button
                            type="button"
                            className={cn("mt-2 h-10", primaryBtn)}
                            onClick={() => setInstitutionOpen(true)}
                          >
                            <Plus className="size-4" />
                            Create Institution
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageItems.map((inst, index) => (
                    <tr
                      key={inst.id}
                      className={cn(
                        "transition hover:bg-[#A2D4ED]/5",
                        index % 2 === 1 && "bg-[#f8fbfe]",
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#A2D4ED]/10 text-xs font-bold text-[#0047AB]">
                            {inst.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#05082E]">
                              {inst.name}
                            </p>
                            <p className="text-xs text-[#0047AB]/65">
                              ID #{inst.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-[#0047AB]">
                        <a
                          href={buildTenantUrl(inst.subdomain) || `/?tenant=${inst.subdomain}`}
                          target="_blank"
                          rel="noreferrer"
                          title={`Open ${inst.name} dashboard`}
                          className="transition hover:text-[#00AAE4] hover:underline"
                        >
                          {inst.subdomain}
                        </a>
                      </td>
                      <td className="px-5 py-3.5 text-[#0047AB]/80">
                        {formatWhen(inst.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={inst.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={togglingId === inst.id}
                          className={outlineBtn}
                          onClick={() =>
                            void toggleStatus(
                              inst.id,
                              inst.status === "Active" ? "Suspended" : "Active",
                            )
                          }
                        >
                          {togglingId === inst.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : inst.status === "Active" ? (
                            "Suspend"
                          ) : (
                            "Activate"
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-[#A2D4ED]/10 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#0047AB]/75">
              {loading
                ? "Loading…"
                : `Showing ${filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={outlineBtn}
                disabled={loading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
                Prev
              </Button>
              <span className="min-w-[4.5rem] text-center text-sm font-medium text-[#05082E]">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={outlineBtn}
                disabled={loading || page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SuperAdminShell>
  )
}

function StatusBadge({ status }: { status: "Active" | "Suspended" }) {
  return (
    <Badge
      className={
        status === "Active"
          ? "shrink-0 border-0 bg-[#A2D4ED]/40 text-[#0047AB]"
          : "shrink-0 border-0 bg-[#F9BF15]/25 text-[#E88D1D]"
      }
    >
      {status}
    </Badge>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#A2D4ED]/10 text-[#0047AB]">
        <Building2 className="size-4" />
      </span>
      <p className="text-sm text-[#0047AB]/70">{message}</p>
    </div>
  )
}
