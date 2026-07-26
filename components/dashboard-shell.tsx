"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { LogOut, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { clearAuth, getDashboardPath, getStoredUser } from "@/lib/api-client"
import { fetchCurrentUser, logout } from "@/services/auth"
import type { User } from "@/types"

export type DashboardNavItem = {
  href: string
  label: string
  exact?: boolean
  icon?: LucideIcon
}

interface DashboardShellProps {
  children: React.ReactNode
  navItems: DashboardNavItem[]
  title: string
  allowedRoles: string[]
  /** Optional feature tabs rendered in the sticky header (replaces default nav row styling). */
  featureNav?: React.ReactNode
}

function isNavActive(pathname: string, item: DashboardNavItem) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function DashboardShell({
  children,
  navItems,
  title,
  allowedRoles,
  featureNav,
}: DashboardShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [user, setUser] = useState<User | null>(null)

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

        if (!allowedRoles.includes(currentUser.role)) {
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
  }, [allowedRoles, router])

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-muted-foreground text-sm">
              {user.full_name} · {user.role.replaceAll("_", " ")}
              {user.institution_id ? ` · center #${user.institution_id}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" />
              Logout
            </Button>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 pb-3">
          {featureNav ? (
            <>
              {featureNav}
              <div className="ml-auto flex shrink-0 gap-1">
                {navItems.map((item) => {
                  const active = isNavActive(pathname, item)
                  return (
                    <Link key={item.href} href={item.href}>
                      <Button variant={active ? "default" : "ghost"} size="sm">
                        {item.label}
                      </Button>
                    </Link>
                  )
                })}
              </div>
            </>
          ) : (
            <nav className="flex gap-1 overflow-x-auto">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isNavActive(pathname, item)
                return (
                  <Link key={item.href} href={item.href}>
                    <Button variant={active ? "default" : "ghost"} size="sm">
                      {Icon ? <Icon className="size-4" aria-hidden /> : null}
                      {item.label}
                    </Button>
                  </Link>
                )
              })}
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}

export function useRequireAuth(allowedRoles: string[]) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

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

        if (!allowedRoles.includes(currentUser.role)) {
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
  }, [allowedRoles, router])

  return user
}
