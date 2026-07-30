"use client"

import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react"
import { useRouter } from "next/navigation"
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
  AlertTriangle,
  CircleCheck,
  GraduationCap,
  HardDrive,
  LogIn,
  Users,
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
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

type InstitutionActionTarget = { id: number; name: string }

function suspendConfirmationPhrase(name: string) {
  return `${name} suspend`
}

function activateConfirmationPhrase(name: string) {
  return `${name} activate`
}

function confirmationMatches(input: string, expected: string) {
  return input.trim().toLowerCase() === expected.trim().toLowerCase()
}

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

function ImpactListItem({
  icon: Icon,
  children,
  tone = "amber",
}: {
  icon: ComponentType<{ className?: string }>
  children: ReactNode
  tone?: "amber" | "slate"
}) {
  return (
    <li className="flex gap-2.5 text-sm leading-snug text-[#05082E]/90">
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
          tone === "amber" ? "bg-amber-100/80 text-amber-800" : "bg-[#A2D4ED]/35 text-[#0047AB]",
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span>{children}</span>
    </li>
  )
}

function TypedConfirmationField({
  id,
  expectedPhrase,
  value,
  onChange,
  matched,
  disabled,
  examplePlaceholder,
}: {
  id: string
  expectedPhrase: string
  value: string
  onChange: (value: string) => void
  matched: boolean
  disabled?: boolean
  examplePlaceholder: string
}) {
  const showMismatch = value.trim().length > 0 && !matched
  return (
    <div className="space-y-2.5">
      <Label htmlFor={id} className="text-sm leading-relaxed text-[#05082E]">
        To confirm, please type{" "}
        <span className="font-semibold text-[#0047AB]">{expectedPhrase}</span> below:
      </Label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={examplePlaceholder}
          className={cn(
            fieldClass,
            "pr-10 transition-shadow focus-visible:border-[#0047AB]/40 focus-visible:ring-2 focus-visible:ring-[#0047AB]/20",
            matched &&
              "border-emerald-400/90 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-200/80",
            showMismatch && "border-red-300/90 focus-visible:ring-red-100",
          )}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
        {matched ? (
          <CircleCheck
            className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-emerald-600"
            aria-hidden
          />
        ) : null}
      </div>
      {showMismatch ? (
        <p className="text-destructive text-xs">
          Confirmation text does not match. Expected:{" "}
          <span className="font-medium">{expectedPhrase}</span>
        </p>
      ) : matched ? (
        <p className="text-xs font-medium text-emerald-700">Confirmation matched — you may proceed.</p>
      ) : null}
    </div>
  )
}

export function SuperAdminInstitutionsPage() {
  const router = useRouter()
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [page, setPage] = useState(1)
  const [institutionOpen, setInstitutionOpen] = useState(false)
  const [credentialsOpen, setCredentialsOpen] = useState(false)
  const [creatingInstitution, setCreatingInstitution] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<InstitutionActionTarget | null>(null)
  const [activateTarget, setActivateTarget] = useState<InstitutionActionTarget | null>(null)
  const [suspendConfirmText, setSuspendConfirmText] = useState("")
  const [activateConfirmText, setActivateConfirmText] = useState("")
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

  useEffect(() => {
    if (suspendTarget) {
      setSuspendConfirmText("")
    }
  }, [suspendTarget])

  useEffect(() => {
    if (activateTarget) {
      setActivateConfirmText("")
    }
  }, [activateTarget])

  const suspendExpectedPhrase = suspendTarget
    ? suspendConfirmationPhrase(suspendTarget.name)
    : ""
  const activateExpectedPhrase = activateTarget
    ? activateConfirmationPhrase(activateTarget.name)
    : ""
  const suspendPhraseMatched = confirmationMatches(suspendConfirmText, suspendExpectedPhrase)
  const activatePhraseMatched = confirmationMatches(activateConfirmText, activateExpectedPhrase)

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

  async function confirmActivateInstitution() {
    if (!activateTarget || !activatePhraseMatched) return
    const { id } = activateTarget
    try {
      setTogglingId(id)
      const updated = await updateInstitutionStatus(id, "Active")
      setInstitutions((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success("Institution activated successfully")
      setActivateTarget(null)
      setActivateConfirmText("")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to activate institution"))
    } finally {
      setTogglingId(null)
    }
  }

  async function confirmSuspendInstitution() {
    if (!suspendTarget || !suspendPhraseMatched) return
    const { id } = suspendTarget
    try {
      setTogglingId(id)
      const updated = await updateInstitutionStatus(id, "Suspended")
      setInstitutions((prev) => prev.map((item) => (item.id === id ? updated : item)))
      toast.success("Institution suspended successfully")
      setSuspendTarget(null)
      setSuspendConfirmText("")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to suspend institution"))
    } finally {
      setTogglingId(null)
    }
  }

  const suspendDialogLoading = suspendTarget !== null && togglingId === suspendTarget.id
  const activateDialogLoading = activateTarget !== null && togglingId === activateTarget.id

  function closeSuspendDialog() {
    if (suspendDialogLoading) return
    setSuspendTarget(null)
    setSuspendConfirmText("")
  }

  function closeActivateDialog() {
    if (activateDialogLoading) return
    setActivateTarget(null)
    setActivateConfirmText("")
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
      title="Institutions"
      description="Search, filter, and manage tenant activation"
      notificationItems={notificationItems}
    >
      {createDialog}

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
        <div className={cn(cardShell, "overflow-hidden")}>
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
                          href={buildTenantUrl(inst.subdomain, "/dashboard")}
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
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className={outlineBtn}
                            onClick={() => router.push(`/admin/institutions/${inst.id}`)}
                          >
                            Open
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={togglingId === inst.id}
                            className={outlineBtn}
                            onClick={() =>
                              inst.status === "Active"
                                ? setSuspendTarget({ id: inst.id, name: inst.name })
                                : setActivateTarget({ id: inst.id, name: inst.name })
                            }
                          >
                            {inst.status === "Active" ? "Suspend" : "Activate"}
                          </Button>
                        </div>
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

      <AlertDialog
        open={Boolean(suspendTarget)}
        onOpenChange={(open) => {
          if (!open) closeSuspendDialog()
        }}
      >
        <AlertDialogContent className="gap-0 border-[#A2D4ED]/60 bg-white p-0 sm:max-w-xl">
          <div className="border-b border-[#A2D4ED]/35 px-6 py-5">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200/80">
                <AlertTriangle className="size-5" />
              </span>
              <div className="min-w-0 space-y-1.5">
                <AlertDialogTitle className="text-lg font-semibold tracking-tight text-[#05082E]">
                  Suspend Institution
                </AlertDialogTitle>
                <p className="text-sm text-[#0047AB]/80">
                  Review the impact before suspending{" "}
                  <span className="font-semibold text-[#05082E]">
                    {suspendTarget?.name ?? "this institution"}
                  </span>
                  .
                </p>
                <Badge
                  variant="outline"
                  className="mt-1 border-amber-200/80 bg-amber-50/80 text-[11px] font-semibold tracking-wide text-amber-900 uppercase"
                >
                  High impact action
                </Badge>
              </div>
            </div>
            <AlertDialogDescription className="sr-only">
              Confirm suspension of {suspendTarget?.name ?? "this institution"}
            </AlertDialogDescription>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-4">
              <p className="mb-3 text-xs font-semibold tracking-wide text-amber-900/90 uppercase">
                After suspension
              </p>
              <ul className="space-y-3">
                <ImpactListItem icon={LogIn} tone="amber">
                  Institution Admin will not be able to log in.
                </ImpactListItem>
                <ImpactListItem icon={GraduationCap} tone="amber">
                  Teachers will not be able to log in.
                </ImpactListItem>
                <ImpactListItem icon={Users} tone="amber">
                  Students and institution users will temporarily lose access.
                </ImpactListItem>
                <ImpactListItem icon={HardDrive} tone="amber">
                  No data will be deleted.
                </ImpactListItem>
                <ImpactListItem icon={RefreshCw} tone="amber">
                  The institution can be activated again later.
                </ImpactListItem>
              </ul>
            </div>

            <TypedConfirmationField
              id="suspend-confirm-input"
              expectedPhrase={suspendExpectedPhrase}
              value={suspendConfirmText}
              onChange={setSuspendConfirmText}
              matched={suspendPhraseMatched}
              disabled={suspendDialogLoading}
              examplePlaceholder={
                suspendTarget ? `e.g., ${suspendConfirmationPhrase(suspendTarget.name)}` : "e.g., KKKM suspend"
              }
            />
          </div>

          <AlertDialogFooter className="flex justify-end gap-3 border-t border-[#A2D4ED]/30 bg-[#f8fbfe]/80 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              className="text-[#0047AB] hover:bg-[#ABD2F2]/35 hover:text-[#05082E]"
              disabled={suspendDialogLoading}
              onClick={closeSuspendDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={cn(
                "gap-2 bg-[#c2410c] font-semibold text-white shadow-sm hover:bg-[#9a3412]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              disabled={suspendDialogLoading || !suspendPhraseMatched}
              onClick={() => void confirmSuspendInstitution()}
            >
              {suspendDialogLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Suspending…
                </>
              ) : (
                "Suspend Institution"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(activateTarget)}
        onOpenChange={(open) => {
          if (!open) closeActivateDialog()
        }}
      >
        <AlertDialogContent className="gap-0 border-[#A2D4ED]/60 bg-white p-0 sm:max-w-xl">
          <div className="border-b border-[#A2D4ED]/35 px-6 py-5">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80">
                <RefreshCw className="size-5" />
              </span>
              <div className="min-w-0 space-y-1.5">
                <AlertDialogTitle className="text-lg font-semibold tracking-tight text-[#05082E]">
                  Activate Institution
                </AlertDialogTitle>
                <p className="text-sm text-[#0047AB]/80">
                  Restore access for{" "}
                  <span className="font-semibold text-[#05082E]">
                    {activateTarget?.name ?? "this institution"}
                  </span>
                  .
                </p>
                <Badge
                  variant="outline"
                  className="mt-1 border-emerald-200/80 bg-emerald-50/80 text-[11px] font-semibold tracking-wide text-emerald-900 uppercase"
                >
                  Restore access
                </Badge>
              </div>
            </div>
            <AlertDialogDescription className="sr-only">
              Confirm activation of {activateTarget?.name ?? "this institution"}
            </AlertDialogDescription>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="rounded-xl border border-[#A2D4ED]/50 bg-slate-50/90 px-4 py-4">
              <p className="mb-3 text-xs font-semibold tracking-wide text-[#0047AB]/80 uppercase">
                After activation
              </p>
              <ul className="space-y-3">
                <ImpactListItem icon={LogIn} tone="slate">
                  Institution admins can log in again.
                </ImpactListItem>
                <ImpactListItem icon={GraduationCap} tone="slate">
                  Teachers can log in and use their dashboards.
                </ImpactListItem>
                <ImpactListItem icon={Users} tone="slate">
                  Students, parents, and other users regain access.
                </ImpactListItem>
              </ul>
            </div>

            <TypedConfirmationField
              id="activate-confirm-input"
              expectedPhrase={activateExpectedPhrase}
              value={activateConfirmText}
              onChange={setActivateConfirmText}
              matched={activatePhraseMatched}
              disabled={activateDialogLoading}
              examplePlaceholder={
                activateTarget
                  ? `e.g., ${activateConfirmationPhrase(activateTarget.name)}`
                  : "e.g., KKKM activate"
              }
            />
          </div>

          <AlertDialogFooter className="flex justify-end gap-3 border-t border-[#A2D4ED]/30 bg-[#f8fbfe]/80 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              className="text-[#0047AB] hover:bg-[#ABD2F2]/35 hover:text-[#05082E]"
              disabled={activateDialogLoading}
              onClick={closeActivateDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={cn(
                "gap-2 bg-[#0047AB] font-semibold text-white shadow-sm hover:bg-[#003580]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              disabled={activateDialogLoading || !activatePhraseMatched}
              onClick={() => void confirmActivateInstitution()}
            >
              {activateDialogLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Activating…
                </>
              ) : (
                "Activate Institution"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperAdminShell>
  )
}

function StatusBadge({ status }: { status: "Active" | "Suspended" }) {
  const active = status === "Active"
  return (
    <Badge
      className={
        active
          ? "shrink-0 border-0 bg-[#A2D4ED]/40 text-[#0047AB]"
          : "shrink-0 border-0 bg-[#F9BF15]/25 text-[#E88D1D]"
      }
    >
      {active ? "Active" : "Suspended"}
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
