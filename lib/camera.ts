/** Stop a camera stream and detach it from a video element. */
export function stopCameraVideo(video: HTMLVideoElement) {
  const stream = video.srcObject
  if (stream && typeof stream === "object" && "getTracks" in stream) {
    const tracks = (stream as { getTracks: () => MediaStreamTrack[] }).getTracks()
    tracks.forEach((track) => {
      try {
        track.stop()
      } catch {
        // The track may already be ended.
      }
    })
  }

  try {
    video.pause()
  } catch {
    // The video may already be detached.
  }

  video.srcObject = null
  video.removeAttribute("src")
  try {
    video.load()
  } catch {
    // Ignore cleanup errors from an already removed video element.
  }
}

/** Stop every camera video rendered below a QR scanner root. */
export function releaseCameraMedia(root: ParentNode | null | undefined) {
  if (!root) return

  root.querySelectorAll("video").forEach((video) => {
    stopCameraVideo(video)
  })
}
