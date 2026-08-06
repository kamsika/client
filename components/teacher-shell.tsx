"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { clearAuth, getDashboardPath, getStoredUser } from "@/lib/api-client"
import { getClientTenant, stripTenantPrefix, withTenantPrefix } from "@/lib/tenant"
import { useInstitutionBranding, useInstitutionBrandingStyle } from "@/hooks/use-institution-branding"
import { getTeacherNav, type TeacherNavItem } from "@/lib/teacher-nav"
import { cn } from "@/lib/utils"
import { fetchCurrentUser, logout } from "@/services/auth"
import type { User } from "@/types"

interface TeacherShellProps {
  children: React.ReactNode
  title?: string
  description?: string
}

function isNavActive(pathname: string, item: TeacherNavItem) {
  const logical = stripTenantPrefix(pathname)
  if (item.exact) return logical === item.href
  return logical === item.href || logical.startsWith(`${item.href}/`)
}

export function TeacherShell({
  children,
  title,
  description,
}: TeacherShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const navItems = getTeacherNav()
  const tenantSlug = getClientTenant()
  const branding = useInstitutionBranding()
  const brandingStyle = useInstitutionBrandingStyle()
  const logoSrc = branding.logoUrl || "/ahms-logo.png"
  const activeItem = navItems.find((item) => isNavActive(pathname, item))
  const pageTitle = title || activeItem?.label || "Teacher Dashboard"
  const pageDescription =
    description || activeItem?.description || "Scan QR codes and manage attendance"

  useEffect(() => {
    setTheme("light")
  }, [setTheme])

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

        if (currentUser.role !== "teacher") {
          router.replace(
            getDashboardPath(currentUser.role, {
              tenant: currentUser.institution?.subdomain || tenantSlug || undefined,
            }),
          )
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
    setMobileOpen(false)
  }, [pathname])

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb] font-sans text-[#05082E] antialiased">
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-12 overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(162,212,237,0.45)] ring-1 ring-[#A2D4ED]/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ahms-logo.png" alt="AHMS" className="size-12 object-cover" />
          </span>
          <p className="text-sm text-[#0047AB]/70">Loading AHMS…</p>
        </div>
      </div>
    )
  }

  const initials = user.full_name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const sidebarWidth = collapsed ? "w-[4.5rem]" : "w-64"

  function renderNav(compact: boolean) {
    return (
      <nav className={cn("flex-1 space-y-1 overflow-y-auto", compact ? "px-2 py-4" : "px-3 py-4")}>
        {!compact && (
          <p className="mb-2 px-2 text-[10px] font-semibold tracking-[0.14em] text-[#0047AB]/45 uppercase">
            Navigation
          </p>
        )}
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isNavActive(pathname, item)
          return (
            <Link
              key={item.href}
              href={withTenantPrefix(item.href, tenantSlug)}
              title={compact ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl transition duration-200",
                compact ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                active
                  ? "text-[#05082E]"
                  : "text-[#0047AB]/75 hover:bg-[#A2D4ED]/25 hover:text-[#05082E]",
              )}
            >
              {Icon ? (
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition",
                    active ? "text-[#E88D1D]" : "text-[#0047AB]/55 group-hover:text-[#0047AB]",
                  )}
                />
              ) : null}
              {!compact && (
                <span className="min-w-0">
                  <span className={cn("block text-sm", active ? "font-semibold" : "font-medium")}>
                    {item.label}
                  </span>
                  {item.description ? (
                    <span
                      className={cn(
                        "block text-[11px]",
                        active ? "text-[#0047AB]/70" : "text-[#0047AB]/50",
                      )}
                    >
                      {item.description}
                    </span>
                  ) : null}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    )
  }

  const sidebar = (opts: { compact: boolean; showCollapse: boolean }) => (
    <aside
      className={cn(
        "relative flex h-full flex-col overflow-hidden border-r border-[#A2D4ED]/50 bg-white text-[#05082E] transition-[width] duration-300",
        opts.compact ? "w-[4.5rem]" : "w-64",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        aria-hidden
        style={{
          background:
            "linear-gradient(180deg, rgba(171,210,242,0.35) 0%, rgba(244,247,251,0.2) 40%, transparent 100%)",
        }}
      />
      <div
        className={cn(
          "relative flex items-center border-b border-[#A2D4ED]/40",
          opts.compact ? "justify-center px-2 py-4" : "gap-3 px-5 py-5",
        )}
      >
        <span className="flex size-10 shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_6px_18px_rgba(162,212,237,0.45)] ring-1 ring-[#A2D4ED]/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="Institution" className="size-10 object-cover" />
        </span>
        {!opts.compact && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-[#05082E]">AHMS</p>
            <p className="truncate text-[11px] text-[#0047AB]/65">Teacher / Checker</p>
          </div>
        )}
      </div>

      {renderNav(opts.compact)}

      <div className={cn("relative border-t border-[#A2D4ED]/40", opts.compact ? "p-2" : "p-4")}>
        {opts.showCollapse && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "mb-2 border-[#A2D4ED] bg-white text-[#0047AB] transition hover:bg-[#ABD2F2]/40 hover:text-[#05082E]",
              opts.compact ? "w-full px-0" : "w-full justify-start gap-2",
            )}
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-3.5" />
            ) : (
              <>
                <PanelLeftClose className="size-3.5" />
                Collapse
              </>
            )}
          </Button>
        )}
        {!opts.compact && (
          <div className="mb-2 rounded-xl bg-[#ABD2F2]/35 px-3 py-3 ring-1 ring-[#A2D4ED]/50">
            <p className="truncate text-sm font-semibold text-[#05082E]">{user.full_name}</p>
            <p className="truncate text-[11px] text-[#0047AB]/70">
              Checker
              {user.institution_id ? ` · #${user.institution_id}` : ""}
            </p>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "border-[#E88D1D]/40 bg-white text-[#E88D1D] transition hover:bg-[#F9BF15]/20 hover:text-[#b45309]",
            opts.compact ? "w-full px-0" : "w-full justify-start gap-2",
          )}
          onClick={logout}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut className="size-3.5" />
          {!opts.compact && "Log out"}
        </Button>
      </div>
    </aside>
  )

  return (
    <div
      className="relative flex min-h-screen bg-[#f4f7fb] font-sans text-[#05082E] antialiased"
      style={brandingStyle}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 100% -10%, rgba(171,210,242,0.55), transparent 50%), radial-gradient(ellipse 50% 35% at 0% 100%, rgba(162,212,237,0.35), transparent 45%)",
        }}
      />

      <div
        className={cn(
          "relative z-20 sticky top-0 hidden h-screen shrink-0 transition-[width] duration-300 lg:block",
          sidebarWidth,
        )}
      >
        {sidebar({ compact: collapsed, showCollapse: true })}
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#05082E]/25 backdrop-blur-sm transition"
            aria-label="Close sidebar"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 shadow-[0_20px_60px_rgba(5,8,46,0.15)] animate-in slide-in-from-left duration-300">
            {sidebar({ compact: false, showCollapse: false })}
          </div>
        </div>
      ) : null}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-[#A2D4ED]/45 bg-white/90 shadow-[0_1px_0_rgba(162,212,237,0.35)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-[#A2D4ED] bg-white text-[#0047AB] lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden border-[#A2D4ED] bg-white text-[#0047AB] lg:inline-flex"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <ChevronRight className="size-4" />
                ) : (
                  <ChevronLeft className="size-4" />
                )}
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight text-[#05082E]">
                  {pageTitle}
                </h1>
                <p className="truncate text-sm text-[#0047AB]/75">{pageDescription}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="mr-1 hidden rounded-lg bg-[#F9BF15]/25 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[#b45309] uppercase md:inline-flex">
                Teacher
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="relative border-[#A2D4ED] bg-white text-[#0047AB]"
                    />
                  }
                >
                  <Bell className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-80 rounded-xl border-[#A2D4ED]/60 bg-white p-0 shadow-[0_18px_50px_rgba(5,8,46,0.1)]"
                >
                  <div className="border-b border-[#A2D4ED]/40 bg-[#f4f7fb] px-3 py-2.5">
                    <p className="text-sm font-semibold text-[#05082E]">Notifications</p>
                    <p className="text-xs text-[#0047AB]/70">Attendance activity updates</p>
                  </div>
                  <p className="px-3 py-8 text-center text-sm text-[#0047AB]/70">
                    No notifications yet
                  </p>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 gap-2 border-[#A2D4ED] bg-white px-2 text-[#0047AB]"
                    />
                  }
                >
                  <Avatar size="sm">
                    <AvatarFallback className="bg-[#ABD2F2]/50 text-[11px] font-semibold text-[#0047AB]">
                      {initials || <UserRound className="size-3.5" />}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[8rem] truncate text-sm font-medium sm:inline">
                    {user.full_name}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 rounded-xl border-[#A2D4ED]/60 bg-white shadow-[0_18px_50px_rgba(5,8,46,0.1)]"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                      <p className="text-sm font-semibold text-[#05082E]">{user.full_name}</p>
                      <p className="truncate text-xs text-[#0047AB]/70">{user.email}</p>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
