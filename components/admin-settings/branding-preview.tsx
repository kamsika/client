"use client"

import type { InstitutionBranding } from "@/lib/institution-branding"
import { cn } from "@/lib/utils"

export function BrandingPreview({ branding }: { branding: InstitutionBranding }) {
  const { primaryColor, secondaryColor, accentColor, logoUrl } = branding

  return (
    <div className="overflow-hidden rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.06)]">
      <div className="border-b border-[#A2D4ED]/40 px-4 py-2.5">
        <p className="text-xs font-semibold tracking-wide text-[#0047AB]/70 uppercase">Live preview</p>
      </div>
      <div className="flex min-h-[280px]">
        <aside
          className="hidden w-28 shrink-0 flex-col gap-2 p-3 sm:flex"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-center gap-2">
            <span className="flex size-8 overflow-hidden rounded-lg bg-white/90">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-[10px] font-bold text-[#0047AB]">
                  AH
                </span>
              )}
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            <span className="block h-2 w-full rounded bg-white/30" />
            <span className="block h-2 w-4/5 rounded bg-white/20" />
            <span className="block h-2 w-3/5 rounded bg-white/20" />
          </div>
        </aside>
        <div className="min-w-0 flex-1 bg-[#f4f7fb]">
          <header
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ backgroundColor: secondaryColor, borderColor: `${primaryColor}22` }}
          >
            <p className="text-sm font-semibold" style={{ color: primaryColor }}>
              Dashboard
            </p>
            <span
              className="size-7 rounded-full"
              style={{ backgroundColor: `${accentColor}55` }}
            />
          </header>
          <div className="space-y-3 p-4">
            <div
              className="rounded-xl border p-3 shadow-sm"
              style={{ backgroundColor: secondaryColor, borderColor: `${primaryColor}25` }}
            >
              <p className="text-xs font-medium" style={{ color: primaryColor }}>
                Overview card
              </p>
              <p className="mt-1 text-[11px] text-[#0047AB]/65">Sample metric and summary text</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm")}
                style={{ backgroundColor: primaryColor }}
              >
                Primary
              </button>
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                style={{
                  borderColor: primaryColor,
                  color: primaryColor,
                  backgroundColor: secondaryColor,
                }}
              >
                Secondary
              </button>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold"
                style={{ backgroundColor: `${accentColor}33`, color: primaryColor }}
              >
                Badge
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
