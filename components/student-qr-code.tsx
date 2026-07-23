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
  /** Database id used to force a fresh canvas when switching students. */
  studentDbId?: number | string
  size?: number
  className?: string
  /** Use canvas when you need download/print via toDataURL. */
  variant?: "canvas" | "svg"
  /** Optional label shown under the QR, e.g. "Sanu (STU-001)". */
  label?: string
}

/**
 * High-contrast, high-quality student QR for on-screen viewing and printing.
 * Payload is a plain ID string only — no JSON/URL wrapper.
 */
export const StudentQrCode = forwardRef<HTMLCanvasElement, StudentQrCodeProps>(
  function StudentQrCode(
    {
      studentId,
      studentDbId,
      size = STUDENT_QR_SIZE,
      className,
      variant = "canvas",
      label,
    },
    ref,
  ) {
    const value = buildStudentQrPayload(studentId)
    const remountKey = `${studentDbId ?? "x"}-${value}`
    const shared = {
      value,
      size,
      level: "H" as const,
      bgColor: "#FFFFFF",
      fgColor: "#000000",
      marginSize: STUDENT_QR_MARGIN_MODULES,
      "aria-label": `QR code for student ${studentId}`,
      "data-student-id": value,
    }

    return (
      <div
        className={cn("inline-flex flex-col items-center gap-2", className)}
        data-qr-payload={value}
        data-student-db-id={studentDbId ?? ""}
      >
        <div className="inline-flex items-center justify-center rounded-md bg-white p-4 shadow-sm ring-1 ring-black/5">
          {/* key forces a brand-new QR canvas whenever the student changes */}
          {variant === "svg" ? (
            <QRCodeSVG key={remountKey} {...shared} />
          ) : (
            <QRCodeCanvas key={remountKey} ref={ref} {...shared} />
          )}
        </div>
        {label ? (
          <p className="max-w-[280px] text-center text-sm font-medium text-black">{label}</p>
        ) : null}
        <p className="font-mono text-[11px] text-neutral-500">QR payload: {value}</p>
      </div>
    )
  },
)
