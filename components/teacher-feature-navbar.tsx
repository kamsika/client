"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { getTeacherFeatureNav } from "@/lib/teacher-nav"
import { cn } from "@/lib/utils"

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Feature tabs for the teacher workspace (Overview, scanners, manual, timetable).
 * Intended to sit inside the sticky DashboardShell header.
 */
export function TeacherFeatureNavbar({ className }: { className?: string }) {
  const pathname = usePathname()
  const items = getTeacherFeatureNav()

  return (
    <nav aria-label="Teacher features" className={cn("min-w-0 flex-1", className)}>
      <ul className="flex gap-1 overflow-x-auto pb-0.5">
        {items.map((item) => {
          const Icon = item.icon
          const active = isActive(pathname, item.href, item.exact)

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
