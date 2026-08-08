import { apiClient } from "@/lib/api-client"

export type SubjectFeeLine = {
  subject_id: number
  subject_name: string
  monthly_fee: number | null
  currency: string
  configured: boolean
}

export type FeeSummary = {
  student_id: number
  billing_period: string
  overall_status: "PAID" | "PENDING"
  subject_charges: number
  previous_balance?: number
  discount_amount?: number
  waived_amount?: number
  net_total: number
  paid_amount: number
  balance_due: number
  advance_credit: number
  status?: string
  legacy?: boolean
  legacy_message?: string
  lines: Array<{
    id: number
    subject_id: number
    subject_name: string
    fee_amount: number
    discount_amount: number
    net_amount: number
    paid_amount: number
    balance_due: number
    status: string
  }>
}

export async function previewRegistrationFees(payload: {
  subjects: string[]
  joiningDate: string
  discount: number
}) {
  const { data } = await apiClient.post<{
    joining_month: string
    lines: SubjectFeeLine[]
    monthly_fee: number
    discount: number
    net_monthly_fee: number
    missing_subjects: string[]
  }>("/api/tuition/registration-preview", payload)
  return data
}

export async function listSubjectFees(history = false) {
  const { data } = await apiClient.get<{ subject_fees: Array<Record<string, unknown>> }>(
    "/api/tuition/subject-fees",
    { params: { history } },
  )
  return data.subject_fees
}

export async function configureSubjectFee(subjectId: number, payload: {
  monthlyFee: number
  currency?: string
  effectiveFrom: string
  isActive?: boolean
  description?: string
}) {
  const { data } = await apiClient.post<{ subject_fee: Record<string, unknown> }>(
    `/api/tuition/subjects/${subjectId}/fees`,
    payload,
  )
  return data.subject_fee
}

export async function getBillingDashboard(billingPeriod?: string) {
  const { data } = await apiClient.get<{ summary: Record<string, number | string> }>(
    "/api/tuition/dashboard",
    { params: { billing_period: billingPeriod } },
  )
  return data.summary
}

export async function listInvoices(params?: { studentId?: number; billingPeriod?: string; status?: string }) {
  const { data } = await apiClient.get<{ invoices: Array<Record<string, unknown>> }>(
    "/api/tuition/invoices",
    { params: { student_id: params?.studentId, billing_period: params?.billingPeriod, status: params?.status } },
  )
  return data.invoices
}

export async function generateInvoice(studentId: number, billingPeriod?: string) {
  const { data } = await apiClient.post<{ invoice: Record<string, unknown>; created: boolean }>(
    "/api/tuition/invoices/generate",
    { student_id: studentId, billing_period: billingPeriod },
  )
  return data
}

export async function generateAllInvoices(billingPeriod?: string) {
  const { data } = await apiClient.post<{ created: number; existing: number; failed: number }>(
    "/api/tuition/invoices/generate-all",
    { billing_period: billingPeriod },
  )
  return data
}

export async function recordTuitionPayment(payload: {
  studentId: number
  amount: number
  paymentMethod: string
  billingPeriod?: string
  subjectId?: number
  referenceNumber?: string
  notes?: string
}) {
  const idempotencyKey = crypto.randomUUID()
  const { data } = await apiClient.post<{ payment: Record<string, unknown>; receipt: Record<string, unknown> }>(
    "/api/tuition/payments",
    payload,
    { headers: { "Idempotency-Key": idempotencyKey } },
  )
  return data
}

export async function listTuitionPayments() {
  const { data } = await apiClient.get<{ payments: Array<Record<string, unknown>> }>("/api/tuition/payments")
  return data.payments
}

export async function getStudentFeeSummary(studentId: number, billingPeriod?: string) {
  const { data } = await apiClient.get<{ fee_summary: FeeSummary }>(
    `/api/tuition/students/${studentId}/summary`,
    { params: { billing_period: billingPeriod } },
  )
  return data.fee_summary
}

export async function getStudentFeeHistory(studentId: number) {
  const { data } = await apiClient.get<{
    invoices: Array<Record<string, unknown>>
    payments: Array<Record<string, unknown>>
    advance_credit: number
  }>(`/api/tuition/students/${studentId}/history`)
  return data
}

export async function downloadTuitionReceipt(receiptId: number) {
  const response = await apiClient.get(`/api/tuition/receipts/${receiptId}/pdf`, { responseType: "blob" })
  const url = URL.createObjectURL(response.data as Blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `tuition-receipt-${receiptId}.pdf`
  anchor.click()
  URL.revokeObjectURL(url)
}
