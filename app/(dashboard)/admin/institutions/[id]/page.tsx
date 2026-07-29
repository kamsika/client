"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Mail, UserRound } from "lucide-react"
import { toast } from "sonner"

import { SuperAdminShell } from "@/components/super-admin-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getApiErrorMessage } from "@/lib/api-errors"
import { cn } from "@/lib/utils"
import {
  changeInstitutionAdminPassword,
  getSuperAdminInstitution,
} from "@/services/password"
import type { Institution, User } from "@/types"

const fieldClass =
  "h-11 border-[#A2D4ED] transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const primaryBtn =
  "gap-2 bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white"

const outlineBtn = "border-[#A2D4ED] text-[#0047AB] transition hover:bg-[#ABD2F2]/40"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function InstitutionStatusBadge({ status }: { status: Institution["status"] }) {
  const active = status === "Active"
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      {status}
    </Badge>
  )
}

function AdminStatusBadge({ admin }: { admin: User | null }) {
  if (!admin) {
    return (
      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
        No admin
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        admin.is_active
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800",
      )}
    >
      {admin.is_active ? "Active" : "Inactive"}
    </Badge>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[#05082E]">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(fieldClass, "pr-10")}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-1 size-8 -translate-y-1/2 text-[#0047AB]/70"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  )
}

export default function SuperAdminInstitutionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const institutionId = Number(params.id)

  const [loading, setLoading] = useState(true)
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [admin, setAdmin] = useState<User | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fieldErrors, setFieldErrors] = useState<{ new?: string; confirm?: string }>({})
  const [saving, setSaving] = useState(false)

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(institutionId)) {
      toast.error("Invalid institution")
      router.replace("/admin/dashboard")
      return
    }
    setLoading(true)
    try {
      const data = await getSuperAdminInstitution(institutionId)
      setInstitution(data.institution)
      setAdmin(data.admin)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load institution"))
      router.replace("/admin/dashboard")
    } finally {
      setLoading(false)
    }
  }, [institutionId, router])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  function validateForm() {
    const errors: { new?: string; confirm?: string } = {}
    if (!newPassword) {
      errors.new = "Password is required"
    } else if (newPassword.length < 8) {
      errors.new = "Password must be at least 8 characters"
    }
    if (!confirmPassword) {
      errors.confirm = "Confirm password is required"
    } else if (confirmPassword !== newPassword) {
      errors.confirm = "Passwords do not match"
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleUpdatePassword() {
    if (!validateForm()) return
    setSaving(true)
    try {
      const result = await changeInstitutionAdminPassword(institutionId, newPassword)
      setAdmin(result.admin)
      toast.success(result.message || "Admin password updated successfully")
      setDialogOpen(false)
      setNewPassword("")
      setConfirmPassword("")
      setFieldErrors({})
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update admin password"))
    } finally {
      setSaving(false)
    }
  }

  function onDialogOpenChange(open: boolean) {
    if (saving) return
    setDialogOpen(open)
    if (!open) {
      setNewPassword("")
      setConfirmPassword("")
      setFieldErrors({})
    }
  }

  const logoLetter = (institution?.name || "I").slice(0, 1).toUpperCase()

  return (
    <SuperAdminShell
      title={institution?.name ?? "Institution"}
      description="Institution details and admin account"
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <Button
          type="button"
          variant="outline"
          className={cn("h-9", outlineBtn)}
          onClick={() => router.push("/admin/dashboard#institutions")}
        >
          <ArrowLeft className="size-4" />
          Back to institutions
        </Button>

        {loading ? (
          <div className={cn(cardShell, "flex items-center justify-center gap-2 p-12 text-[#0047AB]/70")}>
            <Loader2 className="size-5 animate-spin" />
            Loading institution…
          </div>
        ) : institution ? (
          <>
            <div className={cn(cardShell, "p-6 sm:p-8")}>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#A2D4ED]/20 text-2xl font-bold text-[#0047AB] ring-1 ring-[#A2D4ED]/60">
                  {institution.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={institution.logo} alt="" className="size-full object-cover" />
                  ) : (
                    logoLetter
                  )}
                </span>
                <div className="min-w-0 flex-1 space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold text-[#05082E]">{institution.name}</h2>
                    <p className="mt-1 text-sm text-[#0047AB]/75">
                      Created {formatWhen(institution.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <InstitutionStatusBadge status={institution.status} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-xl border border-[#A2D4ED]/40 bg-[#f8fbfe] px-4 py-3">
                      <UserRound className="mt-0.5 size-4 text-[#E88D1D]" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-[#0047AB]/70 uppercase">
                          Admin name
                        </p>
                        <p className="truncate text-sm text-[#05082E]">
                          {admin?.full_name ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl border border-[#A2D4ED]/40 bg-[#f8fbfe] px-4 py-3">
                      <Mail className="mt-0.5 size-4 text-[#E88D1D]" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-[#0047AB]/70 uppercase">
                          Admin email
                        </p>
                        <p className="truncate text-sm text-[#05082E]">{admin?.email ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl border border-[#A2D4ED]/40 bg-[#f8fbfe] px-4 py-3 sm:col-span-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-[#0047AB]/70 uppercase">
                          Admin status
                        </p>
                        <div className="mt-1.5">
                          <AdminStatusBadge admin={admin} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={cn(cardShell, "p-6 sm:p-8")}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#05082E]">Admin account</h3>
                  <p className="mt-1 text-sm text-[#0047AB]/75">
                    Set a new password for this institution&apos;s admin login.
                  </p>
                </div>
                <Button
                  type="button"
                  className={cn("h-10 shrink-0", primaryBtn)}
                  disabled={!admin}
                  onClick={() => setDialogOpen(true)}
                >
                  <KeyRound className="size-4" />
                  Change Admin Password
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Admin Password</DialogTitle>
            <DialogDescription>
              {admin
                ? `Set a new password for ${admin.full_name} (${admin.email}).`
                : "Set a new password for the institution admin."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <PasswordField
              id="new-password"
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              error={fieldErrors.new}
            />
            <PasswordField
              id="confirm-new-password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={fieldErrors.confirm}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className={outlineBtn}
              disabled={saving}
              onClick={() => onDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={primaryBtn}
              disabled={saving}
              onClick={() => void handleUpdatePassword()}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Updating…
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminShell>
  )
}
