"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldOff,
  Sparkles,
} from "lucide-react"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"

import { SuperAdminShell } from "@/components/super-admin-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { listInstitutions } from "@/services/institution"
import type { Institution } from "@/types"

const primaryBtn =
  "gap-2 bg-[#F9BF15] font-semibold text-[#05082E] shadow-[0_8px_24px_rgba(249,191,21,0.35)] transition hover:bg-[#E88D1D] hover:text-white"

const outlineBtn =
  "border-[#A2D4ED] text-[#0047AB] transition hover:bg-[#ABD2F2]/40"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

const CHART_COLORS = {
  active: "#A2D4ED",
  suspended: "#E88D1D",
  navy: "#0047AB",
}

function formatWhen(value?: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-[#A2D4ED]/10", className)} />
  )
}

function StatusBadge({ status }: { status: "Active" | "Suspended" }) {
  const active = status === "Active"
  return (
    <Badge
      className={
        active
          ? "shrink-0 border-0 bg-[#A2D4ED]/40 text-[#0047AB]"
          : "shrink-0 border-0 bg-[#F9BF15]/25 text-[#E88D1D]"
      }
    >
      {active ? "Active" : "Suspended"}
    </Badge>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#A2D4ED]/10 text-[#0047AB]">
        <Building2 className="size-4" />
      </span>
      <p className="text-sm text-[#0047AB]/70">{message}</p>
    </div>
  )
}

export function SuperAdminDashboard() {
  const router = useRouter()
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const inst = await listInstitutions()
      setInstitutions(inst)
    } catch {
      toast.error("Failed to load institutions")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const stats = useMemo(() => {
    const active = institutions.filter((item) => item.status === "Active").length
    const suspended = institutions.filter((item) => item.status === "Suspended").length
    return { total: institutions.length, active, suspended }
  }, [institutions])

  const statusChartData = useMemo(
    () => [
      { name: "Active", value: stats.active, fill: CHART_COLORS.active },
      { name: "Suspended", value: stats.suspended, fill: CHART_COLORS.suspended },
    ],
    [stats.active, stats.suspended],
  )

  const barChartData = useMemo(
    () => [
      { label: "Total", count: stats.total, fill: CHART_COLORS.navy },
      { label: "Active", count: stats.active, fill: CHART_COLORS.active },
      { label: "Suspended", count: stats.suspended, fill: CHART_COLORS.suspended },
    ],
    [stats],
  )

  const recentInstitutions = useMemo(() => {
    return [...institutions]
      .sort((a, b) => {
        const aTime = new Date(a.created_at || 0).getTime()
        const bTime = new Date(b.created_at || 0).getTime()
        return bTime - aTime
      })
      .slice(0, 5)
  }, [institutions])

  const notificationItems = useMemo(
    () =>
      recentInstitutions.map((inst) => ({
        id: String(inst.id),
        title: inst.name,
        detail: `${inst.status} · ${inst.subdomain}`,
        time: formatWhen(inst.created_at),
      })),
    [recentInstitutions],
  )

  return (
    <SuperAdminShell
      title="Dashboard"
      description="Platform overview for institutions and tenant status"
      notificationItems={notificationItems}
    >
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div
          className={cn(
            cardShell,
            "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#F9BF15]/20 text-[#E88D1D]">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="font-semibold text-[#05082E]">Quick actions</p>
              <p className="text-sm text-[#0047AB]/75">
                Onboard a center or refresh platform tenant data
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className={cn("h-10 gap-2", primaryBtn)}
              onClick={() => router.push("/admin/institution")}
            >
              <Building2 className="size-4" />
              Manage Institutions
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn("h-10 gap-2", outlineBtn)}
              disabled={loading}
              onClick={() => void loadData()}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Total institutions",
              value: stats.total,
              icon: Building2,
              gradient: "from-[#ABD2F2]/50 via-white to-white",
              iconWrap: "bg-[#A2D4ED]/50 text-[#0047AB]",
              valueClass: "text-[#05082E]",
              navigateTo: "/admin/institution",
            },
            {
              label: "Active",
              value: stats.active,
              icon: CheckCircle2,
              gradient: "from-[#A2D4ED]/55 via-white to-white",
              iconWrap: "bg-[#A2D4ED] text-[#0047AB]",
              valueClass: "text-[#0047AB]",
            },
            {
              label: "Suspended",
              value: stats.suspended,
              icon: ShieldOff,
              gradient: "from-[#F9BF15]/25 via-white to-white",
              iconWrap: "bg-[#F9BF15]/25 text-[#E88D1D]",
              valueClass: "text-[#E88D1D]",
            },
          ].map((card) => {
            const CardTag = card.navigateTo ? "button" : "div"
            return (
              <CardTag
                key={card.label}
                type={card.navigateTo ? "button" : undefined}
                onClick={card.navigateTo ? () => router.push(card.navigateTo!) : undefined}
                className={cn(
                  "rounded-2xl border border-[#A2D4ED]/50 bg-gradient-to-br p-5 text-left shadow-[0_10px_30px_rgba(5,8,46,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(162,212,237,0.25)]",
                  card.gradient,
                  card.navigateTo && "cursor-pointer",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[#0047AB]">{card.label}</p>
                  <span
                    className={cn(
                      "inline-flex size-9 items-center justify-center rounded-xl",
                      card.iconWrap,
                    )}
                  >
                    <card.icon className="size-4" />
                  </span>
                </div>
                {loading ? (
                  <SkeletonBlock className="mt-3 h-9 w-16" />
                ) : (
                  <p
                    className={cn(
                      "mt-3 text-3xl font-bold tracking-tight tabular-nums",
                      card.valueClass,
                    )}
                  >
                    {card.value}
                  </p>
                )}
              </CardTag>
            )
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className={cn(cardShell, "p-5")}>
            <h3 className="text-sm font-semibold text-[#05082E]">Status distribution</h3>
            <p className="mt-1 text-xs text-[#0047AB]/70">Active vs suspended institutions</p>
            <div className="mt-4 h-52">
              {loading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <SkeletonBlock className="size-32 rounded-full" />
                </div>
              ) : stats.total === 0 ? (
                <EmptyChart message="No institutions yet" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                    >
                      {statusChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid rgba(162,212,237,0.2)",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 flex justify-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-[#0047AB]">
                <span className="size-2 rounded-full bg-[#A2D4ED]" /> Active
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#0047AB]">
                <span className="size-2 rounded-full bg-[#E88D1D]" /> Suspended
              </span>
            </div>
          </div>

          <div className={cn(cardShell, "p-5")}>
            <h3 className="text-sm font-semibold text-[#05082E]">Tenant overview</h3>
            <p className="mt-1 text-xs text-[#0047AB]/70">Counts by current platform status</p>
            <div className="mt-4 h-52">
              {loading ? (
                <div className="flex h-full items-end justify-center gap-3 pb-6">
                  <SkeletonBlock className="h-24 w-10" />
                  <SkeletonBlock className="h-36 w-10" />
                  <SkeletonBlock className="h-16 w-10" />
                </div>
              ) : stats.total === 0 ? (
                <EmptyChart message="No data to chart" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} barSize={28}>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#0047AB", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#0047AB", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(162,212,237,0.06)" }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid rgba(162,212,237,0.2)",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {barChartData.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={cn(cardShell, "p-5")}>
            <h3 className="text-sm font-semibold text-[#05082E]">Recent activity</h3>
            <p className="mt-1 text-xs text-[#0047AB]/70">Latest institutions on the platform</p>
            <div className="mt-4 space-y-2.5">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-14 w-full" />
                ))
              ) : recentInstitutions.length === 0 ? (
                <p className="py-10 text-center text-sm text-[#0047AB]/70">No activity yet</p>
              ) : (
                recentInstitutions.map((inst) => (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => router.push("/admin/institution")}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#A2D4ED]/10 bg-[#f4f7fb] px-3 py-2.5 text-left transition hover:border-[#A2D4ED]/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#05082E]">{inst.name}</p>
                      <p className="truncate text-[11px] text-[#0047AB]/70">
                        {formatWhen(inst.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={inst.status} />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </SuperAdminShell>
  )
}
