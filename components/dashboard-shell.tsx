"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { LogOut, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { getDashboardPath, getStoredUser } from "@/lib/api-client"
import { logout } from "@/services/auth"
import type { User } from "@/types"

interface DashboardShellProps {
  children: React.ReactNode
  navItems: { href: string; label: string }[]
  title: string
  allowedRoles: string[]
}

export function DashboardShell({ children, navItems, title, allowedRoles }: DashboardShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const stored = getStoredUser<User>()
    if (!stored || !allowedRoles.includes(stored.role)) {
      router.replace("/auth/login")
      return
    }
    setUser(stored)
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
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {user.role !== "teacher" && (
              <p className="text-muted-foreground text-sm">
                {user.full_name} · {user.role.replace("_", " ")}
              </p>
            )}
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
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={pathname === item.href || pathname.startsWith(item.href + "/") ? "default" : "ghost"}
                size="sm"
              >
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}

export function useRequireAuth(allowedRoles: string[]) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const stored = getStoredUser<User>()
    if (!stored) {
      router.replace("/auth/login")
      return
    }
    if (!allowedRoles.includes(stored.role)) {
      router.replace(getDashboardPath(stored.role))
      return
    }
    setUser(stored)
  }, [allowedRoles, router])

  return user
}
