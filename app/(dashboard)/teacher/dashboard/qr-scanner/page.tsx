"use client"

import { TeacherLiveQrScanner } from "@/components/teacher-live-qr-scanner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function TeacherQrScannerPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>QR Scanner</CardTitle>
        <CardDescription>
          Point the camera at a student QR code to mark attendance for today.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TeacherLiveQrScanner />
      </CardContent>
    </Card>
  )
}
