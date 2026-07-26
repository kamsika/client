"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { clearAuth, getDashboardPath, getStoredUser } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { fetchCurrentUser, logout } from "@/services/auth"
import type { User } from "@/types"

const SUPER_ADMIN_NAV = [
  {
    href: "/admin/dashboard",
    label: "Institutions",
    description: "Tenants & status",
    icon: Building2,
    exact: true,
  },
] as const

interface SuperAdminShellProps {
  children: React.ReactNode
  title?: string
  description?: string
}

export function SuperAdminShell({
  children,
  title = "Institutions",
  description = "Manage tenant activation and status",
}: SuperAdminShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function verifyAccess() {
      const stored = getStoredUser<User>()
      if (!stored) {
        router.replace("/auth/login")
        return
      }

      try {
        const currentUser = await fetchCurrentUser()
        if (cancelled) return

        if (currentUser.role !== "super_admin") {
          router.replace(getDashboardPath(currentUser.role))
          return
        }

        setUser(currentUser)
      } catch {
        if (cancelled) return
        clearAuth()
        router.replace("/auth/login")
      }
    }

    void verifyAccess()
    return () => {
      cancelled = true
    }
  }, [router])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05082E]">
        <p className="text-sm text-sky-200/70">Loading AHMS…</p>
      </div>
    )
  }

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-sky-400/15 bg-[#05082E] text-white">
      <div className="flex items-center gap-3 border-b border-sky-400/15 px-5 py-5">
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-[0_0_18px_rgba(0,170,228,0.35)] ring-1 ring-[#00AAE4]/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ahms-logo.png"
            alt="AHMS"
            className="size-10 object-cover"
          />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight">AHMS</p>
          <p className="truncate text-[11px] text-sky-200/60">Super Admin Console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="mb-2 px-2 text-[10px] font-semibold tracking-[0.14em] text-sky-200/40 uppercase">
          Overview
        </p>
        <Link
          href="/admin/dashboard"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
            pathname === "/admin/dashboard"
              ? "bg-[#00AAE4]/15 text-[#7DDCF5] ring-1 ring-[#00AAE4]/35"
              : "text-sky-100/70 hover:bg-white/5 hover:text-white",
          )}
        >
          <LayoutDashboard className="size-4 shrink-0" />
          Dashboard
        </Link>

        <p className="mt-5 mb-2 px-2 text-[10px] font-semibold tracking-[0.14em] text-sky-200/40 uppercase">
          Tenants
        </p>
        {SUPER_ADMIN_NAV.map((item) => {
          const Icon = item.icon
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-start gap-3 rounded-lg px-3 py-2.5 transition",
                active
                  ? "bg-[#00AAE4]/15 text-[#7DDCF5] ring-1 ring-[#00AAE4]/35"
                  : "text-sky-100/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="block text-[11px] text-sky-200/40">{item.description}</span>
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sky-400/15 p-4">
        <div className="mb-3 rounded-xl bg-[#0047AB]/25 px-3 py-3 ring-1 ring-[#00AAE4]/20">
          <p className="truncate text-sm font-semibold text-white">{user.full_name}</p>
          <p className="truncate text-[11px] text-sky-200/60">
            {user.role.replaceAll("_", " ")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-sky-400/25 bg-transparent text-white hover:bg-[#00AAE4]/15 hover:text-white"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            Theme
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-sky-400/25 bg-transparent text-white hover:bg-[#00AAE4]/15 hover:text-white"
            onClick={logout}
          >
            <LogOut className="size-3.5" />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex min-h-screen bg-[#f4f7fb] dark:bg-[#070a24]">
      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">{sidebar}</div>

      {/* Mobile drawer */}
      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#05082E]/70"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 shadow-2xl">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-[#00AAE4]/15 bg-white/90 backdrop-blur dark:border-sky-400/10 dark:bg-[#0a0e3d]/90">
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-[#00AAE4]/30 lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                {sidebarOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight text-[#05082E] dark:text-white">
                  {title}
                </h1>
                <p className="truncate text-sm text-[#0047AB]/80 dark:text-sky-200/60">
                  {description}
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-full bg-[#F9BF15]/20 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[#b45309] uppercase dark:bg-[#F9BF15]/15 dark:text-[#F9BF15]">
                Platform Admin
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
