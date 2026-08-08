"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getApiErrorMessage } from "@/lib/api-errors"
import { listStudents } from "@/services/student"
import { listSubjects } from "@/services/subject"
import {
  configureSubjectFee,
  downloadTuitionReceipt,
  generateAllInvoices,
  generateInvoice,
  getBillingDashboard,
  listInvoices,
  listSubjectFees,
  listTuitionPayments,
  recordTuitionPayment,
} from "@/services/tuition"
import type { Student, Subject } from "@/types"

const cardShell = "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"
const fieldClass = "h-10 border-[#A2D4ED] bg-white"
const today = new Date().toISOString().slice(0, 10)
const currentPeriod = today.slice(0, 7)

function money(value: unknown) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function TuitionBillingManager() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [fees, setFees] = useState<Array<Record<string, unknown>>>([])
  const [invoices, setInvoices] = useState<Array<Record<string, unknown>>>([])
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([])
  const [summary, setSummary] = useState<Record<string, number | string>>({})
  const [loading, setLoading] = useState(true)
  const [subjectId, setSubjectId] = useState("")
  const [studentId, setStudentId] = useState("")
  const [feeAmount, setFeeAmount] = useState("")
  const [effectiveFrom, setEffectiveFrom] = useState(`${currentPeriod}-01`)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [reference, setReference] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [subjectRows, studentRows, feeRows, invoiceRows, paymentRows, dashboard] = await Promise.all([
        listSubjects(), listStudents(), listSubjectFees(true), listInvoices(), listTuitionPayments(), getBillingDashboard(),
      ])
      setSubjects(subjectRows)
      setStudents(studentRows)
      setFees(feeRows)
      setInvoices(invoiceRows)
      setPayments(paymentRows)
      setSummary(dashboard)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load tuition billing"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function saveFee() {
    if (!subjectId || Number(feeAmount) < 0 || !effectiveFrom) return toast.error("Select a subject and enter a valid fee")
    setSaving(true)
    try {
      await configureSubjectFee(Number(subjectId), { monthlyFee: Number(feeAmount), currency: "LKR", effectiveFrom })
      toast.success("Subject fee scheduled")
      setFeeAmount("")
      await load()
    } catch (error) { toast.error(getApiErrorMessage(error, "Failed to configure fee")) }
    finally { setSaving(false) }
  }

  async function createMonthlyInvoice() {
    if (!studentId) return toast.error("Select a student")
    setSaving(true)
    try {
      const result = await generateInvoice(Number(studentId), currentPeriod)
      toast.success(result.created ? "Monthly invoice created" : "Invoice already exists")
      await load()
    } catch (error) { toast.error(getApiErrorMessage(error, "Failed to generate invoice")) }
    finally { setSaving(false) }
  }

  async function createAllMonthlyInvoices() {
    setSaving(true)
    try {
      const result = await generateAllInvoices(currentPeriod)
      toast.success(`${result.created} invoices created · ${result.existing} already existed`)
      await load()
    } catch (error) { toast.error(getApiErrorMessage(error, "Failed to generate invoices")) }
    finally { setSaving(false) }
  }

  async function savePayment() {
    if (!studentId || Number(paymentAmount) <= 0) return toast.error("Select a student and enter an amount")
    setSaving(true)
    try {
      await recordTuitionPayment({
        studentId: Number(studentId), amount: Number(paymentAmount), paymentMethod,
        referenceNumber: reference || undefined,
      })
      toast.success("Payment recorded and receipt generated")
      setPaymentAmount("")
      setReference("")
      await load()
    } catch (error) { toast.error(getApiErrorMessage(error, "Failed to record payment")) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#05082E]">Subject-wise Tuition Billing</h2>
          <p className="text-sm text-[#0047AB]/75">Fee history, monthly invoices, allocations, credits, receipts, and audit-safe payments.</p>
        </div>
        <Button variant="outline" onClick={() => void load()}><RefreshCw className="size-4" />Refresh</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Expected", summary.expected_fees], ["Collected", summary.total_collected],
          ["Pending", summary.total_pending], ["Advance", summary.total_advance_credit],
          ["Paid students", summary.paid_students], ["Pending students", summary.pending_students],
        ].map(([label, value]) => (
          <Card key={String(label)} className={cardShell}><CardHeader className="p-4"><CardDescription>{label}</CardDescription><CardTitle className="text-lg">{String(label).includes("students") ? Number(value || 0) : money(value)}</CardTitle></CardHeader></Card>
        ))}
      </div>
      <Tabs defaultValue="fees">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="fees">Subject Fee Setup</TabsTrigger>
          <TabsTrigger value="accounts">Student Accounts & Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments & Receipts</TabsTrigger>
          <TabsTrigger value="audit">Credits, Refunds & Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="fees" className="space-y-4">
          <Card className={cardShell}><CardHeader><CardTitle>Configure subject fee</CardTitle><CardDescription>New effective months preserve all historical invoice values.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-4">
            <div><Label>Subject</Label><Select value={subjectId || null} onValueChange={(v) => v && setSubjectId(v)}><SelectTrigger className={fieldClass}><SelectValue placeholder="Select subject" /></SelectTrigger><SelectContent>{subjects.map((subject) => <SelectItem key={subject.id} value={String(subject.id)}>{subject.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Monthly fee (LKR)</Label><Input type="number" min="0" step="0.01" className={fieldClass} value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} /></div>
            <div><Label>Effective from</Label><Input type="date" className={fieldClass} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></div>
            <div className="flex items-end"><Button disabled={saving} onClick={() => void saveFee()}>{saving && <Loader2 className="size-4 animate-spin" />}Save fee</Button></div>
          </CardContent></Card>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{fees.map((fee) => <Card key={String(fee.id)} className={cardShell}><CardHeader className="p-4"><CardTitle className="text-base">{String(fee.subject_name || "Subject")}</CardTitle><CardDescription>{String(fee.effective_from)} — {String(fee.effective_to || "current")}</CardDescription></CardHeader><CardContent className="flex justify-between px-4 pb-4"><span className="font-semibold">{money(fee.monthly_fee)}</span><Badge variant="outline">{fee.is_active ? "Active" : "Inactive"}</Badge></CardContent></Card>)}</div>
        </TabsContent>
        <TabsContent value="accounts" className="space-y-4">
          <Card className={cardShell}><CardHeader><CardTitle>Generate monthly invoice</CardTitle><CardDescription>Idempotent: repeated generation returns the existing invoice.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row"><Select value={studentId || null} onValueChange={(v) => v && setStudentId(v)}><SelectTrigger className="max-w-md"><SelectValue placeholder="Select student" /></SelectTrigger><SelectContent>{students.map((student) => <SelectItem key={student.id} value={String(student.id)}>{student.full_name} · {student.registration_no}</SelectItem>)}</SelectContent></Select><Button disabled={saving} onClick={() => void createMonthlyInvoice()}>Generate selected</Button><Button variant="outline" disabled={saving} onClick={() => void createAllMonthlyInvoices()}>Generate all · {currentPeriod}</Button></CardContent></Card>
          <div className="space-y-2">{invoices.map((invoice) => <Card key={String(invoice.id)} className={cardShell}><CardContent className="grid gap-2 p-4 sm:grid-cols-5"><span>{String(invoice.student_name || invoice.registration_no)}</span><span>{String(invoice.billing_period)}</span><span>{money(invoice.net_total)}</span><span>Balance {money(invoice.balance_due)}</span><Badge className="w-fit" variant="outline">{String(invoice.status)}</Badge></CardContent></Card>)}</div>
        </TabsContent>
        <TabsContent value="payments" className="space-y-4">
          <Card className={cardShell}><CardHeader><CardTitle>Record payment</CardTitle><CardDescription>Payments allocate oldest outstanding charges first and overpayments become credit.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-5">
            <Select value={studentId || null} onValueChange={(v) => v && setStudentId(v)}><SelectTrigger><SelectValue placeholder="Student" /></SelectTrigger><SelectContent>{students.map((student) => <SelectItem key={student.id} value={String(student.id)}>{student.full_name}</SelectItem>)}</SelectContent></Select>
            <Input type="number" min="0.01" step="0.01" placeholder="Amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["CASH", "CARD", "BANK_TRANSFER", "ONLINE"].map((method) => <SelectItem key={method} value={method}>{method.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select>
            <Input placeholder="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
            <Button disabled={saving} onClick={() => void savePayment()}>Record & receipt</Button>
          </CardContent></Card>
          <div className="space-y-2">{payments.map((payment) => <Card key={String(payment.id)} className={cardShell}><CardContent className="grid gap-2 p-4 sm:grid-cols-7"><span>{String(payment.student_name || payment.student_id)}</span><span>{money(payment.amount)}</span><span>{String(payment.payment_method)}</span><span>{String(payment.receipt_number || "—")}</span><span>{String(payment.recorded_by_name || "—")}</span><Badge variant="outline" className="w-fit">{String(payment.status)}</Badge><Button size="sm" variant="outline" disabled={!payment.id || payment.status !== "COMPLETED"} onClick={() => void downloadTuitionReceipt(Number(payment.id))}>Receipt PDF</Button></CardContent></Card>)}</div>
        </TabsContent>
        <TabsContent value="audit"><Card className={cardShell}><CardHeader><CardTitle>Advance Credits · Discounts and Waivers · Refund/Reversal Management · Teacher Audit</CardTitle><CardDescription>Credits are automatically applied to the next invoice. Refunds and reversals require an institution admin and retain the original transaction. Detailed entries remain in the financial audit ledger.</CardDescription></CardHeader><CardContent><p className="text-sm text-[#0047AB]/75">Use payment history and receipt numbers above to review teacher-recorded collections. No financial transaction is permanently deleted.</p></CardContent></Card></TabsContent>
      </Tabs>
      {loading ? <p className="text-sm text-[#0047AB]/70"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading billing data…</p> : null}
    </div>
  )
}
