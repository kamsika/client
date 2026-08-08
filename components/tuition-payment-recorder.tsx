"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getApiErrorMessage } from "@/lib/api-errors"
import { listStudents } from "@/services/student"
import { generateInvoice, recordTuitionPayment } from "@/services/tuition"
import type { Student } from "@/types"

export function TuitionPaymentRecorder() {
  const [students, setStudents] = useState<Student[]>([])
  const [studentId, setStudentId] = useState("")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("CASH")
  const [reference, setReference] = useState("")
  const [saving, setSaving] = useState(false)
  useEffect(() => { void listStudents().then(setStudents).catch(() => setStudents([])) }, [])

  async function submit() {
    if (!studentId || Number(amount) <= 0) return toast.error("Select a student and enter a valid amount")
    setSaving(true)
    try {
      await generateInvoice(Number(studentId))
      const result = await recordTuitionPayment({
        studentId: Number(studentId), amount: Number(amount), paymentMethod: method,
        referenceNumber: reference || undefined,
      })
      const receipt = result.receipt.receipt_number
      toast.success(`Payment recorded${receipt ? ` · Receipt ${String(receipt)}` : ""}`)
      setAmount("")
      setReference("")
    } catch (error) { toast.error(getApiErrorMessage(error, "Failed to record payment")) }
    finally { setSaving(false) }
  }

  return <Card className="rounded-2xl border border-[#A2D4ED]/60 bg-white">
    <CardHeader><CardTitle className="text-base">Record subject-wise payment</CardTitle><CardDescription>Allocates to the oldest outstanding subject balance. Overpayment becomes advance credit.</CardDescription></CardHeader>
    <CardContent className="grid gap-3 md:grid-cols-5">
      <div><Label>Student</Label><Select value={studentId || null} onValueChange={(v) => v && setStudentId(v)}><SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger><SelectContent>{students.map((student) => <SelectItem key={student.id} value={String(student.id)}>{student.full_name} · {student.registration_no}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Amount</Label><Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div><Label>Method</Label><Select value={method} onValueChange={(v) => v && setMethod(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["CASH", "CARD", "BANK_TRANSFER", "ONLINE"].map((item) => <SelectItem key={item} value={item}>{item.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" /></div>
      <div className="flex items-end"><Button disabled={saving} onClick={() => void submit()}>{saving ? "Saving…" : "Record & receipt"}</Button></div>
    </CardContent>
  </Card>
}
