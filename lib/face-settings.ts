export type FaceRecognitionSettings = {
  recognitionThreshold: number
  cameraDeviceId: string
  autoAttendance: boolean
  soundNotification: boolean
}

const STORAGE_KEY = "ahms_face_recognition_settings"

export const DEFAULT_FACE_SETTINGS: FaceRecognitionSettings = {
  recognitionThreshold: 0.55,
  cameraDeviceId: "",
  autoAttendance: true,
  soundNotification: true,
}

export function loadFaceSettings(): FaceRecognitionSettings {
  if (typeof window === "undefined") return { ...DEFAULT_FACE_SETTINGS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_FACE_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<FaceRecognitionSettings>
    return {
      ...DEFAULT_FACE_SETTINGS,
      ...parsed,
      recognitionThreshold:
        typeof parsed.recognitionThreshold === "number"
          ? Math.min(1.2, Math.max(0.2, parsed.recognitionThreshold))
          : DEFAULT_FACE_SETTINGS.recognitionThreshold,
    }
  } catch {
    return { ...DEFAULT_FACE_SETTINGS }
  }
}

export function saveFaceSettings(settings: FaceRecognitionSettings) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
