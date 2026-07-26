"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, RefreshCw, Search, Wallet } from "lucide-react"
import { toast } from "sonner"

import { InstitutionAdminShell } from "@/components/institution-admin-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { createPayment, listPayments, updatePayment, type FeePaymentStatus } from "@/services/payment"
import { listStudents } from "@/services/student"
import type { Student, StudentFeePayment } from "@/types"

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
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | FeePaymentStatus>("All")
  const [monthFilter, setMonthFilter] = useState<string>(String(now.month))
  const [yearFilter, setYearFilter] = useState<string>(String(now.year))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editPayment, setEditPayment] = useState<StudentFeePayment | null>(null)

  const [formStudentId, setFormStudentId] = useState("")
  const [formMonth, setFormMonth] = useState(String(now.month))
  const [formYear, setFormYear] = useState(String(now.year))
  const [formAmount, setFormAmount] = useState("")
  const [formStatus, setFormStatus] = useState<FeePaymentStatus>("Pending")
  const [formDate, setFormDate] = useState(localTodayISO())

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
      const [paymentRows, studentRows] = await Promise.all([
        listPayments({
          month: monthFilter === "All" ? undefined : monthFilter,
          year: yearFilter === "All" ? undefined : yearFilter,
          status: statusFilter,
          search: query,
        }),
        listStudents(),
      ])
      setPayments(paymentRows)
      setStudents(studentRows)
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

  const paidCount = payments.filter((item) => item.payment_status === "Paid").length
  const pendingCount = payments.filter((item) => item.payment_status !== "Paid").length

  function openCreateDialog() {
    setEditPayment(null)
    setFormStudentId("")
    setFormMonth(monthFilter !== "All" ? monthFilter : String(now.month))
    setFormYear(yearFilter !== "All" ? yearFilter : String(now.year))
    setFormAmount("")
    setFormStatus("Pending")
    setFormDate(localTodayISO())
    setDialogOpen(true)
  }

  function openEditDialog(payment: StudentFeePayment) {
    setEditPayment(payment)
    setFormStudentId(String(payment.student_id ?? payment.studentId ?? ""))
    setFormMonth(String(payment.month ?? now.month))
    setFormYear(String(payment.year ?? now.year))
    setFormAmount(String(payment.amount ?? payment.amount_due ?? ""))
    setFormStatus(payment.payment_status === "Paid" ? "Paid" : "Pending")
    setFormDate(payment.payment_date || payment.paymentDate || localTodayISO())
    setDialogOpen(true)
  }

  async function handleSave() {
    const amount = Number(formAmount)
    if (!editPayment && !formStudentId) {
      toast.error("Select a student")
      return
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid amount")
      return
    }

    setSaving(true)
    try {
      if (editPayment?.id != null) {
        await updatePayment(editPayment.id, {
          amount,
          month: Number(formMonth),
          year: Number(formYear),
          paymentStatus: formStatus,
          paymentDate: formStatus === "Paid" ? formDate : null,
        })
        toast.success("Payment updated")
      } else {
        await createPayment({
          studentId: Number(formStudentId),
          month: Number(formMonth),
          year: Number(formYear),
          amount,
          paymentStatus: formStatus,
          paymentDate: formStatus === "Paid" ? formDate : null,
        })
        toast.success("Payment record added")
      }
      setDialogOpen(false)
      await load()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save payment"))
    } finally {
      setSaving(false)
    }
  }

  async function quickSetStatus(payment: StudentFeePayment, status: FeePaymentStatus) {
    if (payment.id == null) return
    try {
      await updatePayment(payment.id, {
        paymentStatus: status,
        paymentDate: status === "Paid" ? localTodayISO() : null,
      })
      toast.success(`Marked as ${status}`)
      await load()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update status"))
    }
  }

  return (
    <InstitutionAdminShell
      title="Fee Management"
      navItems={getAdminNav(false)}
      allowedRoles={["institution_admin"]}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#05082E]">
              Student Fee Payments
            </h2>
            <p className="mt-1 text-sm text-[#0047AB]/75">
              Track monthly fees and update Paid / Pending status for each student.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className={outlineBtn} onClick={() => void load()}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button
              type="button"
              className="bg-[#05082E] text-white hover:bg-[#05082E]/90"
              onClick={openCreateDialog}
            >
              <Plus className="size-4" />
              Add Fee Record
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className={cn(cardShell, "gap-2 py-4")}>
            <CardHeader className="px-5 pb-0">
              <CardDescription className="text-[#0047AB]/75">Total Records</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#05082E]">
                <Wallet className="size-5 text-[#0047AB]/70" />
                {loading ? "—" : payments.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className={cn(cardShell, "gap-2 py-4")}>
            <CardHeader className="px-5 pb-0">
              <CardDescription className="text-[#0047AB]/75">Paid</CardDescription>
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
            <CardTitle className="text-base text-[#05082E]">Payment Status</CardTitle>
            <CardDescription className="text-[#0047AB]/75">
              Student Name · Grade · Month · Amount · Status
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="min-w-[720px]">
              <TableHeader className="bg-[#f8fbfe]">
                <TableRow className="border-[#A2D4ED]/40 hover:bg-[#f8fbfe]">
                  <TableHead className="text-[#0047AB]">Student Name</TableHead>
                  <TableHead className="text-[#0047AB]">Grade</TableHead>
                  <TableHead className="text-[#0047AB]">Month</TableHead>
                  <TableHead className="text-[#0047AB]">Amount</TableHead>
                  <TableHead className="text-center text-[#0047AB]">Status</TableHead>
                  <TableHead className="text-right text-[#0047AB]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-[#0047AB]/70">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Loading fee records…
                      </span>
                    </TableCell>
                  </TableRow>
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-[#0047AB]/70">
                      No fee records match your filters. Add a monthly fee record to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id ?? `${payment.student_id}-${payment.billing_period}`}>
                      <TableCell className="font-medium text-[#05082E]">
                        {payment.studentName || payment.student_name || "—"}
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {payment.payment_status !== "Paid" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => void quickSetStatus(payment, "Paid")}
                            >
                              Mark Paid
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-amber-200 text-amber-800 hover:bg-amber-50"
                              onClick={() => void quickSetStatus(payment, "Pending")}
                            >
                              Mark Pending
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={outlineBtn}
                            onClick={() => openEditDialog(payment)}
                          >
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-[#A2D4ED]/60 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#05082E]">
              {editPayment ? "Update Fee Record" : "Add Monthly Fee Record"}
            </DialogTitle>
            <DialogDescription className="text-[#0047AB]/75">
              Record amount, payment month, status, and payment date.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {!editPayment ? (
              <div className="space-y-2">
                <Label>Student</Label>
                <Select value={formStudentId} onValueChange={(value) => value && setFormStudentId(value)}>
                  <SelectTrigger className={fieldClass}>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={String(student.id)}>
                        {student.full_name || "Unnamed"} · {student.registration_no}
                        {student.grade ? ` · ${student.grade}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={formMonth} onValueChange={(value) => value && setFormMonth(value)}>
                  <SelectTrigger className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={String(month.value)}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={formYear} onValueChange={(value) => value && setFormYear(value)}>
                  <SelectTrigger className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fee-amount">Amount</Label>
                <Input
                  id="fee-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  className={fieldClass}
                  value={formAmount}
                  onChange={(event) => setFormAmount(event.target.value)}
                  placeholder="3000"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formStatus}
                  onValueChange={(value) => value && setFormStatus(value as FeePaymentStatus)}
                >
                  <SelectTrigger className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formStatus === "Paid" ? (
              <div className="space-y-2">
                <Label htmlFor="fee-payment-date">Payment Date</Label>
                <Input
                  id="fee-payment-date"
                  type="date"
                  className={fieldClass}
                  value={formDate}
                  max={localTodayISO()}
                  onChange={(event) => setFormDate(event.target.value)}
                />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={outlineBtn}
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#05082E] text-white hover:bg-[#05082E]/90"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : editPayment ? (
                "Save Changes"
              ) : (
                "Add Record"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </InstitutionAdminShell>
  )
}
