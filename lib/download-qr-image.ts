import type { RefObject } from "react"

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string) {
  const dataUrl = canvas.toDataURL("image/png")
  const link = document.createElement("a")
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function getQrCanvasFromRef(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  containerRef?: RefObject<HTMLElement | null>,
): HTMLCanvasElement | null {
  if (canvasRef.current) {
    return canvasRef.current
  }

  return containerRef?.current?.querySelector("canvas") ?? null
}
