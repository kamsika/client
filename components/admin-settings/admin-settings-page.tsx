"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { BrandingPreview } from "@/components/admin-settings/branding-preview"
import { InstitutionAdminShell } from "@/components/institution-admin-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { getAdminNav } from "@/lib/admin-nav"
import { getApiErrorMessage } from "@/lib/api-errors"
import {
  AHMS_DEFAULT_BRANDING,
  brandingFromInstitution,
  cacheBranding,
  normalizeBranding,
  normalizeColor,
  readLogoFile,
  THEME_PRESETS,
  type InstitutionBranding,
} from "@/lib/institution-branding"
import { cn } from "@/lib/utils"
import {
  changeAdminPassword,
  fetchAdminSettings,
  updateInstitutionBranding,
  updateInstitutionProfile,
  updateNotificationSettings,
} from "@/services/institution-settings"
import type { Institution, InstitutionNotificationSettings, User } from "@/types"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white p-6 shadow-[0_12px_40px_rgba(5,8,46,0.05)] sm:p-8"

const fieldClass =
  "h-11 border-[#A2D4ED] transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const primaryBtn =
  "gap-2 bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white disabled:opacity-50"

const outlineBtn = "border-[#A2D4ED] text-[#0047AB] hover:bg-[#ABD2F2]/40"

const DEFAULT_NOTIFICATIONS: InstitutionNotificationSettings = {
  email_notifications: true,
  attendance_alerts: true,
  fee_reminder_alerts: true,
  exam_notifications: true,
  announcement_notifications: true,
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
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [admin, setAdmin] = useState<User | null>(null)

  const [profileForm, setProfileForm] = useState({
    name: "",
    contact_email: "",
    phone: "",
    address: "",
    description: "",
  })
  const [profileSaving, setProfileSaving] = useState(false)

  const [brandingDraft, setBrandingDraft] = useState<InstitutionBranding>({
    ...AHMS_DEFAULT_BRANDING,
  })
  const [brandingSaving, setBrandingSaving] = useState(false)

  const [notifications, setNotifications] =
    useState<InstitutionNotificationSettings>(DEFAULT_NOTIFICATIONS)
  const [notificationsSaving, setNotificationsSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [passwordSaving, setPasswordSaving] = useState(false)

  const [dragOver, setDragOver] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAdminSettings()
      setInstitution(data.institution)
      setAdmin(data.admin)
      setProfileForm({
        name: data.institution.name ?? "",
        contact_email: data.institution.contact_email ?? data.institution.email ?? "",
        phone: data.institution.phone ?? data.institution.phone_number ?? "",
        address: data.institution.address ?? "",
        description: data.institution.description ?? "",
      })
      const branding = brandingFromInstitution(data.institution)
      setBrandingDraft(normalizeBranding(branding))
      if (data.institution.id) {
        cacheBranding(data.institution.id, branding)
      }
      setNotifications({
        ...DEFAULT_NOTIFICATIONS,
        ...(data.institution.notifications ?? data.institution.notification_settings),
      })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load settings"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const profileDirty = useMemo(() => {
    if (!institution) return false
    return (
      profileForm.name !== (institution.name ?? "") ||
      profileForm.contact_email !== (institution.contact_email ?? institution.email ?? "") ||
      profileForm.phone !== (institution.phone ?? institution.phone_number ?? "") ||
      profileForm.address !== (institution.address ?? "") ||
      profileForm.description !== (institution.description ?? "")
    )
  }, [institution, profileForm])

  async function saveProfile() {
    if (!profileForm.name.trim()) {
      toast.error("Institution name is required")
      return
    }
    setProfileSaving(true)
    try {
      const result = await updateInstitutionProfile(profileForm)
      setInstitution(result.institution)
      toast.success(result.message)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save profile"))
    } finally {
      setProfileSaving(false)
    }
  }

  function resetProfileForm() {
    if (!institution) return
    setProfileForm({
      name: institution.name ?? "",
      contact_email: institution.contact_email ?? institution.email ?? "",
      phone: institution.phone ?? institution.phone_number ?? "",
      address: institution.address ?? "",
      description: institution.description ?? "",
    })
  }

  async function applyLogoFile(file: File) {
    try {
      const dataUrl = await readLogoFile(file)
      setBrandingDraft((prev) => ({ ...prev, logoUrl: dataUrl }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid logo file")
    }
  }

  async function saveBranding() {
    const normalized = normalizeBranding(brandingDraft)
    setBrandingSaving(true)
    try {
      const result = await updateInstitutionBranding({
        logo_url: normalized.logoUrl,
        primary_color: normalized.primaryColor,
        secondary_color: normalized.secondaryColor,
        accent_color: normalized.accentColor,
        theme_preset: normalized.themePreset,
      })
      setInstitution(result.institution)
      const branding = brandingFromInstitution(result.institution)
      setBrandingDraft(normalizeBranding(branding))
      if (result.institution.id) {
        cacheBranding(result.institution.id, branding)
        window.dispatchEvent(
          new CustomEvent("ahms-branding-updated", { detail: { institutionId: result.institution.id } }),
        )
      }
      toast.success(result.message)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save branding"))
    } finally {
      setBrandingSaving(false)
    }
  }

  function cancelBrandingChanges() {
    if (institution) {
      setBrandingDraft(normalizeBranding(brandingFromInstitution(institution)))
    }
  }

  async function resetBrandingDefault() {
    setBrandingSaving(true)
    try {
      const result = await updateInstitutionBranding({ reset_to_default: true })
      setInstitution(result.institution)
      const branding = brandingFromInstitution(result.institution)
      setBrandingDraft(normalizeBranding(branding))
      if (result.institution.id) {
        cacheBranding(result.institution.id, branding)
        window.dispatchEvent(
          new CustomEvent("ahms-branding-updated", { detail: { institutionId: result.institution.id } }),
        )
      }
      toast.success(result.message)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to reset branding"))
    } finally {
      setBrandingSaving(false)
    }
  }

  async function saveNotifications() {
    setNotificationsSaving(true)
    try {
      const result = await updateNotificationSettings(notifications)
      setInstitution(result.institution)
      toast.success(result.message)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save notifications"))
    } finally {
      setNotificationsSaving(false)
    }
  }

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
      description="Manage your institution profile, branding, and security"
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
          <Tabs defaultValue="profile" className="gap-6">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-[#ABD2F2]/25 p-1">
              <TabsTrigger value="profile" className="px-4 py-2">
                Institution Profile
              </TabsTrigger>
              <TabsTrigger value="branding" className="px-4 py-2">
                Branding
              </TabsTrigger>
              <TabsTrigger value="notifications" className="px-4 py-2">
                Notifications
              </TabsTrigger>
              <TabsTrigger value="security" className="px-4 py-2">
                Security
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <div className={cardShell}>
                <h2 className="text-lg font-semibold text-[#05082E]">Institution Profile</h2>
                <p className="mt-1 text-sm text-[#0047AB]/75">Update your center&apos;s public contact details.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="inst-name">Institution Name</Label>
                    <Input
                      id="inst-name"
                      className={fieldClass}
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inst-email">Email</Label>
                    <Input
                      id="inst-email"
                      type="email"
                      className={fieldClass}
                      value={profileForm.contact_email}
                      onChange={(e) => setProfileForm({ ...profileForm, contact_email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inst-phone">Phone Number</Label>
                    <Input
                      id="inst-phone"
                      className={fieldClass}
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="inst-address">Address</Label>
                    <Input
                      id="inst-address"
                      className={fieldClass}
                      value={profileForm.address}
                      onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="inst-desc">Description</Label>
                    <Textarea
                      id="inst-desc"
                      rows={4}
                      value={profileForm.description}
                      onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                      className="border-[#A2D4ED] focus-visible:ring-[#A2D4ED]/40"
                    />
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button type="button" className={primaryBtn} disabled={profileSaving || !profileDirty} onClick={() => void saveProfile()}>
                    {profileSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                    Save Changes
                  </Button>
                  <Button type="button" variant="outline" className={outlineBtn} disabled={profileSaving || !profileDirty} onClick={resetProfileForm}>
                    Cancel
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="branding">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className={cn(cardShell, "space-y-6 lg:col-span-1")}>
                  <div>
                    <h2 className="text-lg font-semibold text-[#05082E]">Branding</h2>
                    <p className="mt-1 text-sm text-[#0047AB]/75">Logo and colors apply across your tenant dashboard.</p>
                  </div>

                  <div className="space-y-3">
                    <Label>Institution Logo</Label>
                    <div
                      className={cn(
                        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 transition",
                        dragOver ? "border-[#0047AB] bg-[#ABD2F2]/20" : "border-[#A2D4ED]/80 bg-[#f8fbfe]",
                      )}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOver(true)
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDragOver(false)
                        const file = e.dataTransfer.files?.[0]
                        if (file) void applyLogoFile(file)
                      }}
                    >
                      {brandingDraft.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={brandingDraft.logoUrl} alt="Logo preview" className="max-h-20 max-w-[160px] object-contain" />
                      ) : (
                        <Upload className="size-8 text-[#0047AB]/40" />
                      )}
                      <p className="text-center text-xs text-[#0047AB]/70">PNG, JPG, JPEG, or SVG · max 512 KB</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <label
                          className={cn(
                            "inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-medium",
                            outlineBtn,
                          )}
                        >
                          Upload Logo
                          <input
                            type="file"
                            className="sr-only"
                            accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) void applyLogoFile(file)
                              e.target.value = ""
                            }}
                          />
                        </label>
                        {brandingDraft.logoUrl ? (
                          <>
                            <label
                              className={cn(
                                "inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-medium",
                                outlineBtn,
                              )}
                            >
                              Replace Logo
                              <input
                                type="file"
                                className="sr-only"
                                accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) void applyLogoFile(file)
                                  e.target.value = ""
                                }}
                              />
                            </label>
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-[#E88D1D]"
                              onClick={() => setBrandingDraft((p) => ({ ...p, logoUrl: null }))}
                            >
                              Remove Logo
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Theme Presets</Label>
                    <div className="flex flex-wrap gap-2">
                      {THEME_PRESETS.map((preset) => (
                        <Button
                          key={preset.id}
                          type="button"
                          size="sm"
                          variant={brandingDraft.themePreset === preset.id ? "default" : "outline"}
                          className={brandingDraft.themePreset === preset.id ? primaryBtn : outlineBtn}
                          onClick={() =>
                            setBrandingDraft(
                              normalizeBranding({
                                ...brandingDraft,
                                themePreset: preset.id,
                                primaryColor: preset.primaryColor,
                                secondaryColor: preset.secondaryColor,
                                accentColor: preset.accentColor,
                              }),
                            )
                          }
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {(["primaryColor", "secondaryColor", "accentColor"] as const).map((key, index) => {
                    const labels = ["Primary Color", "Secondary Color", "Accent Color"]
                    const fallbacks = {
                      primaryColor: AHMS_DEFAULT_BRANDING.primaryColor,
                      secondaryColor: AHMS_DEFAULT_BRANDING.secondaryColor,
                      accentColor: AHMS_DEFAULT_BRANDING.accentColor,
                    } as const
                    const pickerValue = normalizeColor(brandingDraft[key], fallbacks[key])
                    return (
                      <div key={key} className="grid gap-2 sm:grid-cols-[1fr_120px] sm:items-end">
                        <div className="space-y-2">
                          <Label>{labels[index]}</Label>
                          <Input
                            className={fieldClass}
                            value={brandingDraft[key]}
                            onChange={(e) =>
                              setBrandingDraft({ ...brandingDraft, [key]: e.target.value })
                            }
                            onBlur={() =>
                              setBrandingDraft({
                                ...brandingDraft,
                                [key]: normalizeColor(brandingDraft[key], fallbacks[key]),
                              })
                            }
                          />
                        </div>
                        <Input
                          type="color"
                          className="h-11 w-full cursor-pointer p-1"
                          value={pickerValue}
                          onChange={(e) =>
                            setBrandingDraft({
                              ...brandingDraft,
                              [key]: normalizeColor(e.target.value, fallbacks[key]),
                            })
                          }
                        />
                      </div>
                    )
                  })}

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button type="button" className={primaryBtn} disabled={brandingSaving} onClick={() => void saveBranding()}>
                      {brandingSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                      Save Branding
                    </Button>
                    <Button type="button" variant="outline" className={outlineBtn} disabled={brandingSaving} onClick={cancelBrandingChanges}>
                      Cancel Changes
                    </Button>
                    <Button type="button" variant="ghost" disabled={brandingSaving} onClick={() => void resetBrandingDefault()}>
                      Reset to Default
                    </Button>
                  </div>
                </div>
                <div className="lg:col-span-1">
                  <BrandingPreview branding={normalizeBranding(brandingDraft)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notifications">
              <div className={cardShell}>
                <h2 className="text-lg font-semibold text-[#05082E]">Notifications</h2>
                <p className="mt-1 text-sm text-[#0047AB]/75">Choose which alerts your center receives.</p>
                <div className="mt-6 space-y-5">
                  {(
                    [
                      ["email_notifications", "Email Notifications", "Receive important updates by email."],
                      ["attendance_alerts", "Attendance Alerts", "Get notified when attendance events need attention."],
                      ["fee_reminder_alerts", "Fee Reminder Alerts", "Alerts for pending or overdue fee payments."],
                      ["exam_notifications", "Exam Notifications", "Notifications related to exams and assessments."],
                      ["announcement_notifications", "Announcement Notifications", "Broadcast and announcement activity."],
                    ] as const
                  ).map(([key, title, description]) => (
                    <div key={key} className="flex items-start justify-between gap-4 rounded-xl border border-[#A2D4ED]/40 bg-[#f8fbfe] px-4 py-3">
                      <div>
                        <p className="font-medium text-[#05082E]">{title}</p>
                        <p className="text-sm text-[#0047AB]/70">{description}</p>
                      </div>
                      <Switch
                        checked={notifications[key]}
                        onCheckedChange={(checked) =>
                          setNotifications({ ...notifications, [key]: Boolean(checked) })
                        }
                      />
                    </div>
                  ))}
                </div>
                <Button type="button" className={cn("mt-6", primaryBtn)} disabled={notificationsSaving} onClick={() => void saveNotifications()}>
                  {notificationsSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save Notification Settings
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="security">
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
            </TabsContent>
          </Tabs>
        )}
      </div>
    </InstitutionAdminShell>
  )
}
