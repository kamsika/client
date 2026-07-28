"use client"

import { KioskAttendanceScreen } from "@/components/kiosk-attendance-screen"
import { FaceRecognitionSettingsPanel } from "@/components/face/FaceRecognitionSettings"
import { DEFAULT_FACE_SETTINGS, type FaceRecognitionSettings } from "@/lib/face-settings"
import { cn } from "@/lib/utils"
import { useState } from "react"

const cardShell =
  "rounded-2xl border border-[#A2D4ED]/60 bg-white shadow-[0_12px_40px_rgba(5,8,46,0.05)]"

/**
 * Teacher Face Scanner — wraps the existing kiosk engine (real-time detection + attendance)
 * with settings and result UI. QR attendance is unchanged on its own route.
 */
export function TeacherFaceScanner() {
  const [settings, setSettings] = useState<FaceRecognitionSettings>(DEFAULT_FACE_SETTINGS)

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className={cn(cardShell, "overflow-hidden p-4")}>
        <KioskAttendanceScreen
            cooldownMs={5000}
            matchThreshold={settings.recognitionThreshold}
            autoAttendance={settings.autoAttendance}
            soundNotification={settings.soundNotification}
            cameraDeviceId={settings.cameraDeviceId || undefined}
        />
      </div>
      <FaceRecognitionSettingsPanel onChange={setSettings} />
    </div>
  )
}
