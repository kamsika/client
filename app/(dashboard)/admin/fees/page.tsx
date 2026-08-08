"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Search, Wallet } from "lucide-react"
import { toast } from "sonner"

import { InstitutionAdminShell } from "@/components/institution-admin-shell"
import { TuitionBillingManager } from "@/components/tuition-billing-manager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAdminNav } from "@/lib/admin-nav"
import { getApiErrorMessage } from "@/lib/api-errors"
import { localTodayISO } from "@/lib/format-time"
import { cn } from "@/lib/utils"
import { listPayments, type FeePaymentStatus } from "@/services/payment"
import type { StudentFeePayment } from "@/types"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

const fieldClass =
  "h-10 border-[#A2D4ED] bg-white transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const outlineBtn =
  "border-[#A2D4ED] text-[#0047AB] transition hover:bg-[#ABD2F2]/40"

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
]

function currentMonthYear() {
  const today = localTodayISO()
  const [year, month] = today.split("-").map(Number)
  return { month, year }
}

function statusBadge(status: string | null | undefined) {
  const normalized = String(status || "Pending").trim()
  if (normalized === "Paid") {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
        Paid
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">
      Pending
    </Badge>
  )
}

function formatAmount(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(Number(amount))) return "—"
  return Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatPaymentDate(value: string | null | undefined) {
  if (!value) return "—"
  const datePart = value.slice(0, 10)
  const [year, month, day] = datePart.split("-")
  if (!year || !month || !day) return datePart
  return `${day}/${month}/${year}`
}

function paymentMonthLabel(payment: StudentFeePayment) {
  return (
    payment.monthName ||
    payment.month_name ||
    MONTHS.find((item) => item.value === payment.month)?.label ||
    "—"
  )
}

export default function FeeManagementPage() {
  const now = currentMonthYear()
  const [payments, setPayments] = useState<StudentFeePayment[]>([])
  const [summary, setSummary] = useState<{
    totalCollected?: number
    paidCount?: number
    pendingCount?: number
  }>({})
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | FeePaymentStatus>("All")
  const [monthFilter, setMonthFilter] = useState<string>(String(now.month))
  const [yearFilter, setYearFilter] = useState<string>(String(now.year))

  const yearOptions = useMemo(() => {
    const years = new Set<number>([now.year, now.year - 1, now.year + 1])
    for (const payment of payments) {
      if (payment.year) years.add(payment.year)
    }
    return Array.from(years).sort((a, b) => b - a)
  }, [now.year, payments])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listPayments({
        month: monthFilter === "All" ? undefined : monthFilter,
        year: yearFilter === "All" ? undefined : yearFilter,
        status: statusFilter,
        search: query,
      })
      setPayments(result.payments)
      setSummary({
        totalCollected: result.summary?.totalCollected ?? result.summary?.total_collected,
        paidCount: result.summary?.paidCount ?? result.summary?.paid_count,
        pendingCount: result.summary?.pendingCount ?? result.summary?.pending_count,
      })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load fee records"))
    } finally {
      setLoading(false)
    }
  }, [monthFilter, query, statusFilter, yearFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 200)
    return () => window.clearTimeout(timer)
  }, [load])

  const paidCount = summary.paidCount ?? payments.filter((item) => item.payment_status === "Paid").length
  const pendingCount =
    summary.pendingCount ?? payments.filter((item) => item.payment_status !== "Paid").length
  const totalCollected =
    summary.totalCollected ??
    payments
      .filter((item) => item.payment_status === "Paid")
      .reduce((sum, item) => sum + Number(item.amount ?? item.amount_due ?? 0), 0)

  return (
    <InstitutionAdminShell
      title="Fee Management"
      navItems={getAdminNav(false)}
      allowedRoles={["institution_admin"]}
    >
      <div className="space-y-6">
        <TuitionBillingManager />
        <div className="border-t border-[#A2D4ED]/50 pt-6" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#05082E]">
              Fee Reports
            </h2>
            <p className="mt-1 text-sm text-[#0047AB]/75">
              View-only overview of collected fees, pending balances, and checker collection
              history. Checkers update payments from their dashboard.
            </p>
          </div>
          <Button type="button" variant="outline" className={outlineBtn} onClick={() => void load()}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className={cn(cardShell, "gap-2 py-4")}>
            <CardHeader className="px-5 pb-0">
              <CardDescription className="text-[#0047AB]/75">Total Collected</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#05082E]">
                <Wallet className="size-5 text-[#0047AB]/70" />
                {loading ? "—" : formatAmount(totalCollected)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className={cn(cardShell, "gap-2 py-4")}>
            <CardHeader className="px-5 pb-0">
              <CardDescription className="text-[#0047AB]/75">Records</CardDescription>
              <CardTitle className="text-2xl text-[#05082E]">
                {loading ? "—" : payments.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className={cn(cardShell, "gap-2 py-4")}>
            <CardHeader className="px-5 pb-0">
              <CardDescription className="text-[#0047AB]/75">Paid Students</CardDescription>
              <CardTitle className="text-2xl text-emerald-700">{loading ? "—" : paidCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={cn(cardShell, "gap-2 py-4")}>
            <CardHeader className="px-5 pb-0">
              <CardDescription className="text-[#0047AB]/75">Pending</CardDescription>
              <CardTitle className="text-2xl text-amber-700">{loading ? "—" : pendingCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className={cn(cardShell, "space-y-4 p-4 sm:p-5")}>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-[#05082E]">Month</Label>
              <Select value={monthFilter} onValueChange={(value) => value && setMonthFilter(value)}>
                <SelectTrigger className={fieldClass}>
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All months</SelectItem>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#05082E]">Year</Label>
              <Select value={yearFilter} onValueChange={(value) => value && setYearFilter(value)}>
                <SelectTrigger className={fieldClass}>
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All years</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#05082E]">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  value && setStatusFilter(value as "All" | FeePaymentStatus)
                }
              >
                <SelectTrigger className={fieldClass}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All statuses</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#05082E]">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#A2D4ED]" />
                <Input
                  className={cn(fieldClass, "pl-9")}
                  placeholder="Student name or ID…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <Card className={cn(cardShell, "overflow-hidden py-0")}>
          <CardHeader className="border-b border-[#A2D4ED]/35 px-5 py-4">
            <CardTitle className="text-base text-[#05082E]">Payment History</CardTitle>
            <CardDescription className="text-[#0047AB]/75">
              Student · Grade · Month · Amount · Status · Payment date · Collected by checker
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="min-w-[900px]">
              <TableHeader className="bg-[#f8fbfe]">
                <TableRow className="border-[#A2D4ED]/40 hover:bg-[#f8fbfe]">
                  <TableHead className="text-[#0047AB]">Student Name</TableHead>
                  <TableHead className="text-[#0047AB]">Student ID</TableHead>
                  <TableHead className="text-[#0047AB]">Grade</TableHead>
                  <TableHead className="text-[#0047AB]">Month</TableHead>
                  <TableHead className="text-[#0047AB]">Amount</TableHead>
                  <TableHead className="text-center text-[#0047AB]">Status</TableHead>
                  <TableHead className="text-[#0047AB]">Payment Date</TableHead>
                  <TableHead className="text-[#0047AB]">Collected By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-28 text-center text-[#0047AB]/70">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Loading fee records…
                      </span>
                    </TableCell>
                  </TableRow>
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-28 text-center text-[#0047AB]/70">
                      No fee records match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id ?? `${payment.student_id}-${payment.billing_period}`}>
                      <TableCell className="font-medium text-[#05082E]">
                        {payment.studentName || payment.student_name || "—"}
                      </TableCell>
                      <TableCell className="text-[#05082E]">
                        {payment.registrationNo || payment.registration_no || payment.studentId || "—"}
                      </TableCell>
                      <TableCell className="text-[#05082E]">{payment.grade || "—"}</TableCell>
                      <TableCell className="text-[#05082E]">
                        {paymentMonthLabel(payment)}
                        {payment.year ? ` ${payment.year}` : ""}
                      </TableCell>
                      <TableCell className="tabular-nums text-[#05082E]">
                        {formatAmount(payment.amount ?? payment.amount_due)}
                      </TableCell>
                      <TableCell className="text-center">
                        {statusBadge(payment.payment_status)}
                      </TableCell>
                      <TableCell className="text-[#05082E]">
                        {formatPaymentDate(payment.payment_date || payment.paymentDate)}
                      </TableCell>
                      <TableCell className="text-[#05082E]">
                        {payment.collectedByName || payment.collected_by_name || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </InstitutionAdminShell>
  )
}
