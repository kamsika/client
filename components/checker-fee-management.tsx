"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getApiErrorMessage } from "@/lib/api-errors"
import { localTodayISO } from "@/lib/format-time"
import { cn } from "@/lib/utils"
import {
  createPayment,
  getCurrentStudentPayment,
  listPayments,
  markPaymentAsPaid,
} from "@/services/payment"
import { listStudents } from "@/services/student"
import type { StudentFeePayment } from "@/types"
import { TuitionPaymentRecorder } from "@/components/tuition-payment-recorder"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

const fieldClass =
  "h-10 border-[#A2D4ED] bg-white transition focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"

const outlineBtn =
  "border-[#A2D4ED] text-[#0047AB] transition hover:bg-[#ABD2F2]/40"

type FeeRow = StudentFeePayment & {
  studentName?: string | null
  student_name?: string | null
  registration_no?: string | null
  registrationNo?: string | null
  grade?: string | null
}

function currentMonthYear() {
  const today = localTodayISO()
  const [year, month] = today.split("-").map(Number)
  return { month, year }
}

function statusBadge(status: string | null | undefined) {
  if (status === "Paid") {
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

function monthLabel(payment: FeeRow) {
  return payment.monthName || payment.month_name || "Current month"
}

function rowStudentId(row: FeeRow) {
  return row.student_id ?? row.studentId ?? 0
}

export function CheckerFeeManagement() {
  const period = useMemo(() => currentMonthYear(), [])
  const [rows, setRows] = useState<FeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [confirmRow, setConfirmRow] = useState<FeeRow | null>(null)
  const [amountDialogOpen, setAmountDialogOpen] = useState(false)
  const [pendingAmount, setPendingAmount] = useState("")
  const [pendingRow, setPendingRow] = useState<FeeRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const search = query.trim()
      const { payments } = await listPayments({
        month: period.month,
        year: period.year,
        search: search || undefined,
      })

      const merged = new Map<number, FeeRow>()
      for (const payment of payments) {
        const id = payment.student_id ?? payment.studentId
        if (id != null) merged.set(id, payment as FeeRow)
      }

      if (search) {
        const students = await listStudents(search)
        for (const student of students) {
          if (merged.has(student.id)) continue
          const payment = await getCurrentStudentPayment(student.id)
          merged.set(student.id, {
            ...payment,
            student_id: student.id,
            studentId: student.id,
            studentName: student.full_name,
            student_name: student.full_name,
            registration_no: student.registration_no,
            registrationNo: student.registration_no,
            grade: student.grade,
          })
        }
      }

      const sorted = Array.from(merged.values()).sort((a, b) => {
        const nameA = (a.studentName || a.student_name || "").toLowerCase()
        const nameB = (b.studentName || b.student_name || "").toLowerCase()
        return nameA.localeCompare(nameB)
      })
      setRows(sorted)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load fee records"))
    } finally {
      setLoading(false)
    }
  }, [period.month, period.year, query])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [load])

  async function completeMarkPaid(row: FeeRow, amountOverride?: number) {
    const studentId = rowStudentId(row)
    if (!studentId) return

    const rowKey = row.id != null ? `payment-${row.id}` : `student-${studentId}`
    setMarkingId(rowKey)
    try {
      let amount = row.amount ?? row.amount_due ?? amountOverride
      if (row.id == null && (amount == null || amount <= 0)) {
        if (amountOverride == null || amountOverride <= 0) {
          setPendingRow(row)
          setPendingAmount("")
          setAmountDialogOpen(true)
          return
        }
        amount = amountOverride
      }

      if (row.id == null && amount != null && amount > 0) {
        await createPayment({
          studentId,
          month: row.month ?? period.month,
          year: row.year ?? period.year,
          amount,
          paymentStatus: "Paid",
          paymentDate: localTodayISO(),
        })
      } else {
        await markPaymentAsPaid(row, studentId)
      }

      toast.success("Payment marked as Paid")
      setConfirmRow(null)
      setAmountDialogOpen(false)
      setPendingRow(null)
      await load()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update payment"))
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#05082E]">Fee Management</h2>
          <p className="mt-1 text-sm text-[#0047AB]/75">
            Search students by name or ID, review this month&apos;s fee, and mark payments as
            collected.
          </p>
        </div>
        <Button type="button" variant="outline" className={outlineBtn} onClick={() => void load()}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <TuitionPaymentRecorder />

      <div className={cn(cardShell, "space-y-4 p-4 sm:p-5")}>
        <div className="space-y-2">
          <Label className="text-[#05082E]">Search student</Label>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#A2D4ED]" />
            <Input
              className={cn(fieldClass, "pl-9")}
              placeholder="Student name or registration ID…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
      </div>

      <Card className={cn(cardShell, "overflow-hidden py-0")}>
        <CardHeader className="border-b border-[#A2D4ED]/35 px-5 py-4">
          <CardTitle className="text-base text-[#05082E]">Current month fees</CardTitle>
          <CardDescription className="text-[#0047AB]/75">
            Student · ID · Grade · Amount · Status · Payment date
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[880px]">
            <TableHeader className="bg-[#f8fbfe]">
              <TableRow className="border-[#A2D4ED]/40 hover:bg-[#f8fbfe]">
                <TableHead className="text-[#0047AB]">Student Name</TableHead>
                <TableHead className="text-[#0047AB]">Student ID</TableHead>
                <TableHead className="text-[#0047AB]">Grade</TableHead>
                <TableHead className="text-[#0047AB]">Amount</TableHead>
                <TableHead className="text-center text-[#0047AB]">Status</TableHead>
                <TableHead className="text-[#0047AB]">Payment Date</TableHead>
                <TableHead className="text-[#0047AB]">Collected By</TableHead>
                <TableHead className="text-right text-[#0047AB]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-[#0047AB]/70">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Loading fees…
                    </span>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-[#0047AB]/70">
                    No students match your search for this month.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const studentId = rowStudentId(row)
                  const rowKey = row.id != null ? `payment-${row.id}` : `student-${studentId}`
                  const isPending = row.payment_status !== "Paid"
                  return (
                    <TableRow key={rowKey}>
                      <TableCell className="font-medium text-[#05082E]">
                        {row.studentName || row.student_name || "—"}
                      </TableCell>
                      <TableCell className="text-[#05082E]">
                        {row.registration_no || row.registrationNo || studentId || "—"}
                      </TableCell>
                      <TableCell className="text-[#05082E]">{row.grade || "—"}</TableCell>
                      <TableCell className="tabular-nums text-[#05082E]">
                        {formatAmount(row.amount ?? row.amount_due)}
                        <span className="ml-1 text-xs text-[#0047AB]/65">({monthLabel(row)})</span>
                      </TableCell>
                      <TableCell className="text-center">{statusBadge(row.payment_status)}</TableCell>
                      <TableCell className="text-[#05082E]">
                        {formatPaymentDate(row.payment_date || row.paymentDate)}
                      </TableCell>
                      <TableCell className="text-[#05082E]">
                        {row.collectedByName || row.collected_by_name || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {isPending ? (
                          <Button
                            type="button"
                            size="sm"
                            className="bg-[#05082E] text-white hover:bg-[#05082E]/90"
                            disabled={markingId === rowKey}
                            onClick={() => setConfirmRow(row)}
                          >
                            {markingId === rowKey ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                Saving…
                              </>
                            ) : (
                              "Mark as Paid"
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-emerald-700">Paid</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={confirmRow != null} onOpenChange={(open) => !open && setConfirmRow(null)}>
        <DialogContent className="border-[#A2D4ED]/60 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#05082E]">Confirm payment</DialogTitle>
            <DialogDescription className="text-[#0047AB]/75">
              Mark {confirmRow?.studentName || confirmRow?.student_name || "this student"}&apos;s{" "}
              {confirmRow ? monthLabel(confirmRow) : "Current month"} fee as paid today?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={outlineBtn}
              onClick={() => setConfirmRow(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#05082E] text-white hover:bg-[#05082E]/90"
              onClick={() => confirmRow && void completeMarkPaid(confirmRow)}
            >
              Mark as Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={amountDialogOpen} onOpenChange={setAmountDialogOpen}>
        <DialogContent className="border-[#A2D4ED]/60 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#05082E]">Fee amount required</DialogTitle>
            <DialogDescription className="text-[#0047AB]/75">
              Enter the monthly fee amount before marking this payment as collected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="checker-fee-amount">Amount</Label>
            <Input
              id="checker-fee-amount"
              type="number"
              min="0"
              step="0.01"
              className={fieldClass}
              value={pendingAmount}
              onChange={(event) => setPendingAmount(event.target.value)}
              placeholder="5000"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={outlineBtn}
              onClick={() => {
                setAmountDialogOpen(false)
                setPendingRow(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#05082E] text-white hover:bg-[#05082E]/90"
              onClick={() => {
                const amount = Number(pendingAmount)
                if (!Number.isFinite(amount) || amount <= 0) {
                  toast.error("Enter a valid amount")
                  return
                }
                if (pendingRow) void completeMarkPaid(pendingRow, amount)
              }}
            >
              Save &amp; Mark Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
