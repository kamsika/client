import { stopCameraVideo } from "@/lib/camera"

// Local weights downloaded via `npm run download-models`; CDN is a fallback
// in case the local files haven't been fetched yet.
const LOCAL_MODEL_BASE = "/models"
const CDN_MODEL_BASE = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model"
export const FACE_MATCH_THRESHOLD = 0.55
/** Default distance threshold for kiosk FaceMatcher matching. */
export const KIOSK_MATCH_THRESHOLD = 0.6

/** Average multiple 128-d descriptors (multi-angle registration). */
export function averageEmbeddings(vectors: number[][]): number[] | null {
  const valid = vectors.filter((v) => v.length === 128)
  if (valid.length === 0) return null
  const dim = 128
  const sums = new Array(dim).fill(0)
  for (const vec of valid) {
    for (let i = 0; i < dim; i += 1) sums[i] += vec[i]
  }
  return sums.map((value) => value / valid.length)
}

let modelsLoaded = false
let modelsLoading: Promise<void> | null = null

export interface FaceMatch {
  studentId: number
  label: string
  distance: number
}

export type FaceMatcherInstance = Awaited<ReturnType<typeof createFaceMatcher>>

async function loadFromBase(base: string) {
  const faceapi = await import("@vladmandic/face-api")
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(base),
    faceapi.nets.faceLandmark68Net.loadFromUri(base),
    faceapi.nets.faceRecognitionNet.loadFromUri(base),
  ])
}

export async function loadFaceModels() {
  if (modelsLoaded) return
  if (modelsLoading) {
    await modelsLoading
    return
  }

  modelsLoading = (async () => {
    try {
      await loadFromBase(LOCAL_MODEL_BASE)
    } catch {
      console.warn("[face] Local models not found in /models, falling back to CDN")
      await loadFromBase(CDN_MODEL_BASE)
    }
    modelsLoaded = true
  })()

  try {
    await modelsLoading
  } catch (error) {
    modelsLoading = null
    throw error
  }
}

export async function detectFaceDescriptor(video: HTMLVideoElement): Promise<number[] | null> {
  const detection = await detectFaceWithBox(video)
  return detection?.descriptor ?? null
}

export interface FaceBox {
  x: number
  y: number
  width: number
  height: number
}

export interface FaceDetectionResult {
  descriptor: number[]
  box: FaceBox
}

/** Detect a single face and return both the 128-d descriptor and screen-space box. */
export async function detectFaceWithBox(
  video: HTMLVideoElement,
): Promise<FaceDetectionResult | null> {
  const detections = await detectFacesWithBoxes(video)
  return detections[0] ?? null
}

/** Detect all faces in the current video frame. */
export async function detectFacesWithBoxes(
  video: HTMLVideoElement,
): Promise<FaceDetectionResult[]> {
  await loadFaceModels()
  const faceapi = await import("@vladmandic/face-api")

  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return []
  }

  const detections = await faceapi
    .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors()

  return detections.map((detection) => {
    const { x, y, width, height } = detection.detection.box
    return {
      descriptor: Array.from(detection.descriptor),
      box: { x, y, width, height },
    }
  })
}

/**
 * Build a face-api.js FaceMatcher from enrolled student descriptors.
 * Labels are student IDs (as strings) so matches can be mapped back to records.
 */
export async function createFaceMatcher(
  profiles: Array<{ id: number; descriptor: number[] }>,
  threshold = KIOSK_MATCH_THRESHOLD,
) {
  await loadFaceModels()
  const faceapi = await import("@vladmandic/face-api")

  const labeled = profiles
    .filter((profile) => profile.descriptor.length === 128)
    .map(
      (profile) =>
        new faceapi.LabeledFaceDescriptors(String(profile.id), [
          new Float32Array(profile.descriptor),
        ]),
    )

  if (labeled.length === 0) {
    return null
  }

  return new faceapi.FaceMatcher(labeled, threshold)
}

/** Match a descriptor against a FaceMatcher; returns null when unknown / no match. */
export function matchWithFaceMatcher(
  matcher: NonNullable<FaceMatcherInstance>,
  descriptor: number[],
  profilesById: Map<number, { label: string }>,
): FaceMatch | null {
  const best = matcher.findBestMatch(new Float32Array(descriptor))
  if (!best || best.label === "unknown") {
    return null
  }

  const studentId = Number(best.label)
  if (!Number.isFinite(studentId)) {
    return null
  }

  const profile = profilesById.get(studentId)
  return {
    studentId,
    label: profile?.label ?? best.label,
    distance: best.distance,
  }
}

/** Draw detection boxes (and optional labels) onto a canvas sized to the video. */
export function drawFaceOverlays(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detections: Array<{
    box: FaceBox
    label?: string
    matched?: boolean
    alreadyMarked?: boolean
  }>,
) {
  const width = video.videoWidth || video.clientWidth
  const height = video.videoHeight || video.clientHeight
  if (!width || !height) return

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (const detection of detections) {
    const { x, y, width: boxW, height: boxH } = detection.box
    const alreadyMarked = detection.alreadyMarked ?? false
    const matched = detection.matched ?? false

    if (alreadyMarked) {
      ctx.strokeStyle = "#38bdf8"
    } else if (matched) {
      ctx.strokeStyle = "#22c55e"
    } else {
      ctx.strokeStyle = "#facc15"
    }
    ctx.lineWidth = Math.max(3, Math.round(width / 320))
    ctx.strokeRect(x, y, boxW, boxH)

    if (detection.label) {
      const padding = 6
      ctx.font = `600 ${Math.max(14, Math.round(width / 40))}px system-ui, sans-serif`
      const textWidth = ctx.measureText(detection.label).width
      const labelH = Math.max(22, Math.round(width / 28))
      if (alreadyMarked) {
        ctx.fillStyle = "rgba(14, 165, 233, 0.92)"
      } else if (matched) {
        ctx.fillStyle = "rgba(34, 197, 94, 0.9)"
      } else {
        ctx.fillStyle = "rgba(250, 204, 21, 0.9)"
      }
      ctx.fillRect(x, Math.max(0, y - labelH), textWidth + padding * 2, labelH)
      ctx.fillStyle = alreadyMarked ? "#082f49" : matched ? "#052e16" : "#422006"
      ctx.fillText(detection.label, x + padding, Math.max(labelH - 6, y - 6))
    }
  }
}

export function clearFaceOverlay(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

/** Short success chime for kiosk recognition feedback (Web Audio, no asset required). */
export function playSuccessChime() {
  if (typeof window === "undefined") return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99]

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02 + index * 0.08)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18 + index * 0.08)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + index * 0.08)
      osc.stop(now + 0.22 + index * 0.08)
    })

    window.setTimeout(() => void ctx.close(), 800)
  } catch {
    // Audio is optional feedback — ignore failures (autoplay policies, etc.).
  }
}

export function matchFaceDescriptor(
  descriptor: number[],
  profiles: Array<{ id: number; label: string; descriptor: number[] }>,
  threshold = FACE_MATCH_THRESHOLD,
): FaceMatch | null {
  if (profiles.length === 0) {
    return null
  }

  let best: FaceMatch | null = null

  for (const profile of profiles) {
    if (profile.descriptor.length !== descriptor.length) {
      continue
    }

    let sum = 0
    for (let index = 0; index < descriptor.length; index += 1) {
      const delta = descriptor[index] - profile.descriptor[index]
      sum += delta * delta
    }
    const distance = Math.sqrt(sum)

    if (distance <= threshold && (!best || distance < best.distance)) {
      best = {
        studentId: profile.id,
        label: profile.label,
        distance,
      }
    }
  }

  return best
}

async function startCameraStream(video: HTMLVideoElement, deviceId?: string): Promise<MediaStream> {
  const attempts: MediaTrackConstraints[] = deviceId
    ? [{ deviceId: { exact: deviceId } }, { deviceId }]
    : [{}, { facingMode: "user" }, { facingMode: "environment" }]

  // Restarting a camera must release the previous stream first. Otherwise the
  // old stream is lost when srcObject is replaced and keeps the camera busy.
  stopCameraVideo(video)

  let lastError: unknown = null
  for (const videoConstraints of attempts) {
    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints })
      video.srcObject = stream
      await video.play()
      return stream
    } catch (error) {
      if (stream) {
        stopCameraVideo(video)
      }
      lastError = error
    }
  }

  throw lastError ?? new Error("Unable to access camera")
}

export async function startFaceCamera(video: HTMLVideoElement, deviceId?: string): Promise<MediaStream> {
  return startCameraStream(video, deviceId)
}

export function stopFaceCamera(video: HTMLVideoElement) {
  stopCameraVideo(video)
}

export function getCameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera permission was denied. Allow camera access in your browser site settings and try again."
    }
    if (error.name === "NotFoundError") {
      return "No camera was found on this device."
    }
    if (error.name === "NotReadableError") {
      return "The camera is in use by another app. Close other apps using the webcam and try again."
    }
  }

  const message = error instanceof Error ? error.message : String(error ?? "")
  if (/secure context|https|localhost/i.test(message)) {
    return "Camera requires HTTPS or localhost."
  }
  if (/permission|denied|not allowed/i.test(message)) {
    return "Camera permission was denied. Allow camera access and try again."
  }

  return message || "Unable to access the camera."
}
