"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from "lucide-react"
import { useEffect, useState } from "react"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getApiErrorMessage } from "@/lib/api-errors"
import { cn } from "@/lib/utils"
import {
  AHMS_DEFAULT_BRANDING,
  brandingCssVariables,
  brandingFromInstitution,
  type InstitutionBranding,
} from "@/lib/institution-branding"
import { getClientTenant } from "@/lib/tenant"
import { login, resolveLoginRedirect } from "@/services/auth"
import { resolveTenant } from "@/services/tenant"

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [tenantBranding, setTenantBranding] = useState<InstitutionBranding>({
    ...AHMS_DEFAULT_BRANDING,
  })
  const [tenantName, setTenantName] = useState<string | null>(null)

  useEffect(() => {
    const slug = getClientTenant()
    if (!slug) return
    void resolveTenant(slug).then((result) => {
      if (result.institution) {
        setTenantBranding(brandingFromInstitution(result.institution))
        setTenantName(result.institution.name)
      }
    })
  }, [])

  const brandingStyle = brandingCssVariables(tenantBranding)
  const loginLogo = tenantBranding.logoUrl || "/ahms-logo.png"
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: FormData) {
    try {
      const data = await login(values.email.trim(), values.password)
      toast.success("Login successful")
      const destination = resolveLoginRedirect(data)
      if (destination.crossOrigin) {
        window.location.replace(destination.url)
        return
      }
      router.replace(destination.url)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Invalid email or password"))
    }
  }

  return (
    <div
      className="relative flex min-h-screen bg-[#f4f7fb] font-sans text-[#05082E] antialiased"
      style={brandingStyle}
    >
      {/* Brand panel — matches home hero (#05082E) */}
      <aside className="relative hidden w-[44%] overflow-hidden bg-[#05082E] text-white lg:flex lg:flex-col lg:justify-between lg:p-10 xl:w-[46%]">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-24 right-0 size-[26rem] rounded-full bg-[#0047AB]/25 blur-3xl" />
          <div className="absolute bottom-0 left-[-20%] size-72 rounded-full bg-[#F9BF15]/12 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.1] [background-image:linear-gradient(rgba(162,212,237,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(162,212,237,0.35)_1px,transparent_1px)] [background-size:48px_48px]" />
        </div>

        <Link
          href="/"
          className="relative z-10 inline-flex items-center gap-2.5 transition hover:opacity-90"
        >
          <span className="flex size-11 overflow-hidden rounded-xl bg-white shadow-[0_0_16px_rgba(162,212,237,0.35)] ring-1 ring-[#A2D4ED]/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={loginLogo} alt={tenantName || "AHMS"} className="size-11 object-cover" />
          </span>
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight">{tenantName || "AHMS"}</p>
            <p className="text-[11px] font-medium text-[#ABD2F2]/70">Student Management System</p>
          </div>
        </Link>

        <div className="relative z-10 max-w-md animate-in fade-in slide-in-from-left-4 duration-700">
          <p className="text-sm font-semibold tracking-[0.16em] text-[#F9BF15] uppercase">
            Secure access
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight xl:text-4xl">
            Sign in to manage students, classrooms, and attendance
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#ABD2F2]/75 xl:text-base">
            Use your AHMS account to open the role-based dashboard for admins, teachers, students,
            or parents.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-[#ABD2F2]/80">
            {[
              "QR & face attendance for classrooms",
              "Student records and enrolled subjects",
              "Attendance reports and parent alerts",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="size-1.5 shrink-0 rounded-full bg-[#F9BF15]" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-[#A2D4ED]/45">
          © {new Date().getFullYear()} AHMS · Student Management System
        </p>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(171,210,242,0.45),_transparent_55%)]"
          aria-hidden
        />

        <div className="relative z-10 mb-6 w-full max-w-[420px] lg:hidden">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="flex size-10 overflow-hidden rounded-xl bg-white shadow-[0_6px_18px_rgba(162,212,237,0.45)] ring-1 ring-[#A2D4ED]/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={loginLogo} alt={tenantName || "AHMS"} className="size-10 object-cover" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-bold text-[#05082E]">{tenantName || "AHMS"}</p>
              <p className="text-[10px] font-medium text-[#0047AB]/75">Student Management System</p>
            </div>
          </Link>
        </div>

        <div className="relative z-10 w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-3 duration-500">
          <Link
            href="/"
            className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#0047AB]/80 transition hover:text-[#0047AB]"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Link>

          <div className="rounded-2xl border border-[#A2D4ED]/60 bg-white p-6 shadow-[0_12px_40px_rgba(5,8,46,0.05)] sm:p-8">
            <div className="mb-6">
              <p className="text-xs font-semibold tracking-[0.14em] text-[#F9BF15] uppercase">
                Welcome back
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#05082E]">Sign in</h2>
              <p className="mt-1.5 text-sm text-[#0047AB]/75">
                Use your email and password to continue
              </p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#05082E]">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#0047AB]/55" />
                  <Input
                    id="email"
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={cn(
                      "h-11 border-[#A2D4ED] pl-10 transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40",
                      form.formState.errors.email && "border-destructive",
                    )}
                    {...form.register("email")}
                  />
                </div>
                {form.formState.errors.email && (
                  <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#05082E]">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#0047AB]/55" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={cn(
                      "h-11 border-[#A2D4ED] pr-10 pl-10 transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40",
                      form.formState.errors.password && "border-destructive",
                    )}
                    {...form.register("password")}
                  />
                  <button
                    type="button"
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-[#0047AB]/70 transition hover:text-[#0047AB]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-destructive text-sm">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="h-11 w-full bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white disabled:opacity-50"
              >
                {form.formState.isSubmitting ? "Signing in…" : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 space-y-3 border-t border-[#A2D4ED]/40 pt-5 text-center text-sm">
              <p>
                <Link
                  href="/auth/parent-login"
                  className="font-medium text-[#0047AB] transition hover:text-[#E88D1D]"
                >
                  Parent login (phone number)
                </Link>
              </p>
              <p className="text-[#0047AB]/70">
                Need an account?{" "}
                <Link
                  href="/auth/register"
                  className="font-semibold text-[#0047AB] transition hover:text-[#E88D1D]"
                >
                  Register as teacher, student, or parent
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
