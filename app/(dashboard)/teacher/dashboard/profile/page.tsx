"use client"

import { useEffect, useState } from "react"
import { Mail, Shield, UserRound } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getStoredUser } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { fetchCurrentUser } from "@/services/auth"
import type { User } from "@/types"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

export default function TeacherProfilePage() {
  const [user, setUser] = useState<User | null>(getStoredUser<User>())

  useEffect(() => {
    let cancelled = false
    void fetchCurrentUser()
      .then((current) => {
        if (!cancelled) setUser(current)
      })
      .catch(() => {
        /* shell handles auth failures */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const initials = (user?.full_name || "T")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[#05082E]">Profile</h2>
        <p className="text-sm text-[#0047AB]/75">
          Your checker account details for this tuition center.
        </p>
      </div>

      <div className={cn(cardShell, "p-6")}>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar className="size-16">
            <AvatarFallback className="bg-[#ABD2F2]/50 text-lg font-semibold text-[#0047AB]">
              {initials || <UserRound className="size-6" />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-[#05082E]">
              {user?.full_name || "Teacher"}
            </p>
            <p className="text-sm text-[#0047AB]/75">Teacher / Checker</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-[#A2D4ED]/40 bg-[#f8fbfe] px-4 py-3">
            <Mail className="mt-0.5 size-4 text-[#E88D1D]" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#0047AB]/70 uppercase">
                Email
              </p>
              <p className="text-sm text-[#05082E]">{user?.email || "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-[#A2D4ED]/40 bg-[#f8fbfe] px-4 py-3">
            <Shield className="mt-0.5 size-4 text-[#E88D1D]" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#0047AB]/70 uppercase">
                Role
              </p>
              <p className="text-sm text-[#05082E]">
                {(user?.role || "teacher").replaceAll("_", " ")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-[#A2D4ED]/40 bg-[#f8fbfe] px-4 py-3">
            <UserRound className="mt-0.5 size-4 text-[#E88D1D]" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#0047AB]/70 uppercase">
                Center ID
              </p>
              <p className="text-sm text-[#05082E]">
                {user?.institution_id != null ? `#${user.institution_id}` : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
