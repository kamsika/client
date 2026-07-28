"use client"

import { useEffect, useState } from "react"
import { Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  DEFAULT_FACE_SETTINGS,
  loadFaceSettings,
  saveFaceSettings,
  type FaceRecognitionSettings,
} from "@/lib/face-settings"

interface FaceRecognitionSettingsPanelProps {
  onChange?: (settings: FaceRecognitionSettings) => void
}

export function FaceRecognitionSettingsPanel({ onChange }: FaceRecognitionSettingsPanelProps) {
  const [settings, setSettings] = useState<FaceRecognitionSettings>(DEFAULT_FACE_SETTINGS)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    const loaded = loadFaceSettings()
    setSettings(loaded)
    onChange?.(loaded)
  }, [onChange])

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return
    void navigator.mediaDevices.enumerateDevices().then((devices) => {
      setCameras(devices.filter((device) => device.kind === "videoinput"))
    })
  }, [])

  function update(partial: Partial<FaceRecognitionSettings>) {
    const next = { ...settings, ...partial }
    setSettings(next)
    saveFaceSettings(next)
    onChange?.(next)
  }

  return (
    <Card className="border-[#A2D4ED]/60 shadow-[0_12px_40px_rgba(5,8,46,0.05)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#05082E]">
          <Settings2 className="size-5 text-[#0047AB]" />
          Face Recognition Settings
        </CardTitle>
        <CardDescription className="text-[#0047AB]/75">
          Stored locally in this browser for the teacher kiosk.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="face-threshold" className="text-[#05082E]">
            Recognition threshold (lower = stricter)
          </Label>
          <Input
            id="face-threshold"
            type="number"
            min={0.2}
            max={1.2}
            step={0.05}
            className="border-[#A2D4ED] focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40"
            value={settings.recognitionThreshold}
            onChange={(event) =>
              update({ recognitionThreshold: Number(event.target.value) || DEFAULT_FACE_SETTINGS.recognitionThreshold })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="face-camera" className="text-[#05082E]">
            Camera selection
          </Label>
          <select
            id="face-camera"
            className="border-[#A2D4ED] bg-background focus-visible:border-[#ABD2F2] focus-visible:ring-[#A2D4ED]/40 h-10 w-full rounded-md border px-3 text-sm text-[#05082E]"
            value={settings.cameraDeviceId}
            onChange={(event) => update({ cameraDeviceId: event.target.value })}
          >
            <option value="">Default camera</option>
            {cameras.map((camera) => (
              <option key={camera.deviceId} value={camera.deviceId}>
                {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#05082E]">Auto attendance</p>
            <p className="text-muted-foreground text-xs">Mark Present automatically on match.</p>
          </div>
          <Switch
            checked={settings.autoAttendance}
            onCheckedChange={(checked) => update({ autoAttendance: checked })}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#05082E]">Sound notification</p>
            <p className="text-muted-foreground text-xs">Play a short chime when a student is recognized.</p>
          </div>
          <Switch
            checked={settings.soundNotification}
            onCheckedChange={(checked) => update({ soundNotification: checked })}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="border-[#A2D4ED] text-[#0047AB] hover:bg-[#ABD2F2]/40"
          onClick={() => update({ ...DEFAULT_FACE_SETTINGS })}
        >
          Reset defaults
        </Button>
      </CardContent>
    </Card>
  )
}
