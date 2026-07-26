import { apiClient } from "@/lib/api-client"
import type { StudentFeePayment } from "@/types"

export type FeePaymentStatus = "Paid" | "Pending"

export async function listPayments(params?: {
  month?: number | string
  year?: number | string
  status?: FeePaymentStatus | "All"
  search?: string
  studentId?: number
}) {
  const { data } = await apiClient.get<{
    payments: StudentFeePayment[]
    count?: number
    summary?: {
      total_collected?: number
      totalCollected?: number
      paid_count?: number
      paidCount?: number
      pending_count?: number
      pendingCount?: number
    }
  }>(
    "/api/payments",
    {
      params: {
        month: params?.month,
        year: params?.year,
        status: params?.status && params.status !== "All" ? params.status : undefined,
        search: params?.search?.trim() || undefined,
        student_id: params?.studentId,
      },
    },
  )
  return {
    payments: data.payments ?? [],
    summary: data.summary,
  }
}

export async function createPayment(payload: {
  studentId: number
  month: number
  year: number
  amount: number
  paymentStatus: FeePaymentStatus
  paymentDate?: string | null
}) {
  const { data } = await apiClient.post<{ success?: boolean; payment: StudentFeePayment }>(
    "/api/payments",
    {
      student_id: payload.studentId,
      month: payload.month,
      year: payload.year,
      amount: payload.amount,
      payment_status: payload.paymentStatus,
      payment_date: payload.paymentDate || undefined,
    },
  )
  return data.payment
}

export async function getStudentPayments(studentId: number) {
  const { data } = await apiClient.get<{
    payments: StudentFeePayment[]
    student_id: number
    student_name?: string | null
    grade?: string | null
  }>(`/api/payments/student/${studentId}`)
  return data
}

export async function getCurrentStudentPayment(studentId: number) {
  const { data } = await apiClient.get<{
    payment: StudentFeePayment
    payment_status?: FeePaymentStatus | "Overdue"
    paymentStatus?: FeePaymentStatus | "Overdue"
  }>(`/api/payments/current/${studentId}`)
  return data.payment
}

export async function updatePayment(
  paymentId: number,
  payload: {
    paymentStatus?: FeePaymentStatus
    amount?: number
    month?: number
    year?: number
    paymentDate?: string | null
  },
) {
  const { data } = await apiClient.put<{ success?: boolean; payment: StudentFeePayment }>(
    `/api/payments/${paymentId}`,
    {
      payment_status: payload.paymentStatus,
      amount: payload.amount,
      month: payload.month,
      year: payload.year,
      payment_date: payload.paymentDate,
    },
  )
  return data.payment
}

/** Mark the current or existing monthly fee as paid (checker flow). */
export async function markPaymentAsPaid(payment: StudentFeePayment, studentId: number) {
  const today = new Date().toISOString().slice(0, 10)
  if (payment.id != null) {
    return updatePayment(payment.id, {
      paymentStatus: "Paid",
      paymentDate: today,
    })
  }

  const month = payment.month ?? new Date().getMonth() + 1
  const year = payment.year ?? new Date().getFullYear()
  const amount = payment.amount ?? payment.amount_due ?? 0

  return createPayment({
    studentId,
    month,
    year,
    amount,
    paymentStatus: "Paid",
    paymentDate: today,
  })
}
