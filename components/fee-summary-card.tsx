"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { FeeSummary } from "@/services/tuition"

function money(value: number | null | undefined) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function FeeSummaryCard({ summary, unavailable = false }: { summary?: FeeSummary | null; unavailable?: boolean }) {
  if (unavailable) {
    return <Card className="border-blue-200 bg-blue-50"><CardContent className="p-4 text-sm text-blue-800">Fee status unavailable. Attendance can continue normally.</CardContent></Card>
  }
  if (!summary) return <Card className="border-[#A2D4ED]/50"><CardContent className="p-4 text-sm text-[#0047AB]/70">Loading fee status…</CardContent></Card>
  const paid = summary.overall_status === "PAID"
  const partial = summary.overall_status === "PARTIALLY_PAID"
  const subjects = summary.subjects ?? summary.lines
  return (
    <Card className={paid ? "border-emerald-200 bg-emerald-50/60" : partial ? "border-amber-200 bg-amber-50/70" : "border-red-200 bg-red-50/70"}>
      <CardHeader className="flex-row items-center justify-between p-4 pb-2">
        <CardTitle className="text-base">Fee Summary · {summary.billing_period}</CardTitle>
        <Badge className={paid ? "bg-emerald-600 text-white" : partial ? "bg-amber-500 text-white" : "bg-red-600 text-white"}>{summary.overall_status.replaceAll("_", " ")}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-1 text-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <span>Total fee: <b>{money(summary.total_fee ?? summary.net_total)}</b></span>
          <span>Total paid: <b>{money(summary.total_paid ?? summary.paid_amount)}</b></span>
          <span>Pending: <b>{money(summary.total_pending ?? summary.balance_due)}</b></span>
          <span className="text-blue-700">Advance: <b>{money(summary.advance_credit)}</b></span>
        </div>
        {subjects.length > 0 ? <div className="space-y-1 border-t pt-2">{subjects.map((line) => <div key={line.id ?? line.subject_id} className="grid grid-cols-[1fr_auto] gap-3"><span>{line.subject_name} · fee {money(line.fee_amount)} · paid {money(line.paid_amount)} · balance {money(line.balance_due)}</span><span className={line.status === "PAID" ? "text-emerald-700" : line.status === "PARTIALLY_PAID" ? "text-amber-700" : "text-red-700"}>{line.status.replaceAll("_", " ")}</span></div>)}</div> : null}
        {summary.legacy_message ? <p className="text-xs text-[#0047AB]/70">{summary.legacy_message}</p> : null}
        {!paid ? <p className="font-medium text-amber-800">Payment is pending. Attendance is not blocked.</p> : null}
      </CardContent>
    </Card>
  )
}
