"use client"

import { forwardRef } from "react"
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react"

import {
  STUDENT_QR_MARGIN_MODULES,
  STUDENT_QR_SIZE,
  buildStudentQrPayload,
} from "@/lib/student-qr-payload"
import { cn } from "@/lib/utils"

interface StudentQrCodeProps {
  /** Plain student ID / registration number stored inside the QR (e.g. STU-2026-001). */
  studentId: string
  size?: number
  className?: string
  /** Use canvas when you need download/print via toDataURL. */
  variant?: "canvas" | "svg"
}

/**
 * High-contrast, high-quality student QR for on-screen viewing and printing.
 * Payload is a plain ID string only — no JSON/URL wrapper.
 */
export const StudentQrCode = forwardRef<HTMLCanvasElement, StudentQrCodeProps>(
  function StudentQrCode(
    { studentId, size = STUDENT_QR_SIZE, className, variant = "canvas" },
    ref,
  ) {
    const value = buildStudentQrPayload(studentId)
    const shared = {
      value,
      size,
      level: "H" as const,
      bgColor: "#FFFFFF",
      fgColor: "#000000",
      marginSize: STUDENT_QR_MARGIN_MODULES,
      "aria-label": `QR code for student ${studentId}`,
    }

    return (
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-md bg-white p-4 shadow-sm ring-1 ring-black/5",
          className,
        )}
      >
        {variant === "svg" ? (
          <QRCodeSVG {...shared} />
        ) : (
          <QRCodeCanvas ref={ref} {...shared} />
        )}
      </div>
    )
  },
)

/** @deprecated Prefer `studentId` prop via StudentQrCode */
export function StudentQrCodeByRegistration({
  registrationNo,
  size = STUDENT_QR_SIZE,
  className,
}: {
  registrationNo: string
  size?: number
  className?: string
}) {
  return <StudentQrCode studentId={registrationNo} size={size} className={className} variant="svg" />
}
