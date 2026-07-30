"use client"

import { useCallback, useEffect, useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { InstitutionAdminShell } from "@/components/institution-admin-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getAdminNav } from "@/lib/admin-nav"
import { getApiErrorMessage } from "@/lib/api-errors"
import { cn } from "@/lib/utils"
import { changeAdminPassword, fetchAdminSettings } from "@/services/institution-settings"
import type { User } from "@/types"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white p-6 shadow-[0_12px_40px_rgba(5,8,46,0.05)] sm:p-8"

const fieldClass =
  "h-11 border-[#A2D4ED] transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const primaryBtn =
  "gap-2 bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white disabled:opacity-50"

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
  onChange: (v: string) => void
  error?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(fieldClass, "pr-10")}
          autoComplete="off"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-1 size-8 -translate-y-1/2"
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

export function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [admin, setAdmin] = useState<User | null>(null)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [passwordSaving, setPasswordSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAdminSettings()
      setAdmin(data.admin)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load settings"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function updatePassword() {
    const errors: Record<string, string> = {}
    if (!currentPassword) errors.current = "Current password is required"
    if (!newPassword) errors.new = "New password is required"
    else if (newPassword.length < 8) errors.new = "Password must be at least 8 characters"
    if (confirmPassword !== newPassword) errors.confirm = "Passwords do not match"
    setPasswordErrors(errors)
    if (Object.keys(errors).length > 0) return

    setPasswordSaving(true)
    try {
      const result = await changeAdminPassword(currentPassword, newPassword)
      toast.success(result.message)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordErrors({})
      void load()
    } catch (error) {
      const message = getApiErrorMessage(error, "Failed to update password")
      if (/current password/i.test(message)) {
        setPasswordErrors({ current: message })
      } else {
        toast.error(message)
      }
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <InstitutionAdminShell
      title="Settings"
      description="Account security and password"
      navItems={getAdminNav(false)}
      allowedRoles={["institution_admin"]}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {loading ? (
          <div className={cn(cardShell, "flex items-center justify-center gap-2 py-16 text-[#0047AB]/70")}>
            <Loader2 className="size-5 animate-spin" />
            Loading settings…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className={cardShell}>
              <h2 className="text-lg font-semibold text-[#05082E]">Change Password</h2>
              <div className="mt-6 space-y-4">
                <PasswordField
                  id="current-password"
                  label="Current Password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  error={passwordErrors.current}
                />
                <PasswordField
                  id="new-password"
                  label="New Password"
                  value={newPassword}
                  onChange={setNewPassword}
                  error={passwordErrors.new}
                />
                <PasswordField
                  id="confirm-password"
                  label="Confirm Password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  error={passwordErrors.confirm}
                />
              </div>
              <Button
                type="button"
                className={cn("mt-6", primaryBtn)}
                disabled={
                  passwordSaving ||
                  !currentPassword ||
                  !newPassword ||
                  newPassword.length < 8 ||
                  confirmPassword !== newPassword
                }
                onClick={() => void updatePassword()}
              >
                {passwordSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                Update Password
              </Button>
            </div>
            <div className="space-y-6">
              <div className={cardShell}>
                <h3 className="font-semibold text-[#05082E]">Last Login</h3>
                <p className="mt-2 text-sm text-[#0047AB]/80">
                  {admin?.last_login_at
                    ? new Date(admin.last_login_at).toLocaleString()
                    : "No login recorded yet"}
                </p>
                <p className="mt-1 text-xs text-[#0047AB]/60">Signed in as {admin?.email}</p>
              </div>
              <div className={cardShell}>
                <h3 className="font-semibold text-[#05082E]">Active Sessions</h3>
                <p className="mt-2 text-sm text-[#0047AB]/75">This browser session is active.</p>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="rounded-lg border border-[#A2D4ED]/40 px-3 py-2">Current device · Active now</li>
                </ul>
              </div>
              <div className={cardShell}>
                <h3 className="font-semibold text-[#05082E]">Future Features</h3>
                <ul className="mt-3 space-y-2 text-sm text-[#0047AB]/75">
                  <li className="flex items-center justify-between rounded-lg bg-[#f4f7fb] px-3 py-2">
                    Two-Factor Authentication <span className="text-xs font-medium text-[#0047AB]/50">Coming Soon</span>
                  </li>
                  <li className="flex items-center justify-between rounded-lg bg-[#f4f7fb] px-3 py-2">
                    Login History <span className="text-xs font-medium text-[#0047AB]/50">Coming Soon</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </InstitutionAdminShell>
  )
}
