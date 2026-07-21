const MODEL_BASE = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model"
export const FACE_MATCH_THRESHOLD = 0.55

let modelsLoaded = false
let modelsLoading: Promise<void> | null = null

export interface FaceMatch {
  studentId: number
  label: string
  distance: number
}

export async function loadFaceModels() {
  if (modelsLoaded) return
  if (modelsLoading) {
    await modelsLoading
    return
  }

  modelsLoading = (async () => {
    const faceapi = await import("@vladmandic/face-api")
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_BASE),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE),
    ])
    modelsLoaded = true
  })()

  await modelsLoading
}

export async function detectFaceDescriptor(video: HTMLVideoElement): Promise<number[] | null> {
  await loadFaceModels()
  const faceapi = await import("@vladmandic/face-api")

  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return null
  }

  const detection = await faceapi
    .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor()

  if (!detection) {
    return null
  }

  return Array.from(detection.descriptor)
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

async function startCameraStream(video: HTMLVideoElement): Promise<MediaStream> {
  const attempts: MediaTrackConstraints[] = [{}, { facingMode: "user" }, { facingMode: "environment" }]

  let lastError: unknown = null
  for (const videoConstraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints })
      video.srcObject = stream
      await video.play()
      return stream
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error("Unable to access camera")
}

export async function startFaceCamera(video: HTMLVideoElement): Promise<MediaStream> {
  return startCameraStream(video)
}

export function stopFaceCamera(video: HTMLVideoElement) {
  const stream = video.srcObject
  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((track) => track.stop())
  }
  video.srcObject = null
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
