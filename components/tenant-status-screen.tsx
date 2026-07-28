"use client"

import { Building2, ShieldAlert } from "lucide-react"

/** Full-page states for unknown or inactive institution subdomains. */
export function TenantStatusScreen({
  variant,
  subdomain,
  institutionName,
}: {
  variant: "not_found" | "suspended"
  subdomain?: string
  institutionName?: string | null
}) {
  const notFound = variant === "not_found"
  const Icon = notFound ? Building2 : ShieldAlert

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f4f7fb] px-4 font-sans text-[#05082E] antialiased">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 100% -10%, rgba(171,210,242,0.55), transparent 50%), radial-gradient(ellipse 50% 35% at 0% 100%, rgba(162,212,237,0.35), transparent 45%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#A2D4ED]/60 bg-white p-8 text-center shadow-[0_18px_50px_rgba(5,8,46,0.08)]">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-[#ABD2F2]/40 text-[#0047AB]">
          <Icon className="size-6" />
        </span>

        <h1 className="text-xl font-bold tracking-tight text-[#05082E]">
          {notFound ? "Institution not found" : "This institution is currently inactive."}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-[#0047AB]/75">
          {notFound ? (
            <>
              We could not find an institution for
              {subdomain ? (
                <span className="font-semibold text-[#05082E]"> {subdomain}</span>
              ) : (
                " this address"
              )}
              . Please check the address or contact your administrator.
            </>
          ) : (
            <>
              {institutionName ? (
                <span className="font-semibold text-[#05082E]">{institutionName}</span>
              ) : (
                "This account"
              )}{" "}
              has been suspended. Please contact platform support to restore access.
            </>
          )}
        </p>

        <div className="mt-6 flex items-center justify-center gap-2 border-t border-[#A2D4ED]/40 pt-5">
          <span className="flex size-8 overflow-hidden rounded-lg bg-white ring-1 ring-[#A2D4ED]/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ahms-logo.png" alt="AHMS" className="size-8 object-cover" />
          </span>
          <p className="text-xs font-medium text-[#0047AB]/70">AHMS · Student Management System</p>
        </div>
      </div>
    </div>
  )
}
