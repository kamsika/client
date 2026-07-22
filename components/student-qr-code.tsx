"use client"

import { QRCodeSVG } from "qrcode.react"

import { buildStudentQrPayload } from "@/lib/student-qr-payload"

interface StudentQrCodeProps {
  registrationNo: string
  size?: number
  className?: string
}

export function StudentQrCode({ registrationNo, size = 180, className }: StudentQrCodeProps) {
  return (
    <QRCodeSVG
      value={buildStudentQrPayload(registrationNo)}
      size={size}
      level="M"
      className={className}
      aria-label={`QR code for student ${registrationNo}`}
    />
  )
}
