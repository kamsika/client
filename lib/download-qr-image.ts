import type { RefObject } from "react"

import { studentQrDownloadFilename } from "@/lib/student-qr-payload"

/** Extra white padding around the QR when downloading/printing (pixels). */
const DOWNLOAD_PADDING_PX = 32

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string) {
  const padded = createPaddedQrCanvas(canvas, DOWNLOAD_PADDING_PX)
  const dataUrl = padded.toDataURL("image/png")
  const link = document.createElement("a")
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function downloadStudentQrCanvas(canvas: HTMLCanvasElement, studentId: string) {
  downloadCanvasAsPng(canvas, studentQrDownloadFilename(studentId))
}

export function createPaddedQrCanvas(source: HTMLCanvasElement, paddingPx = DOWNLOAD_PADDING_PX) {
  const size = Math.max(source.width, source.height) + paddingPx * 2
  const output = document.createElement("canvas")
  output.width = size
  output.height = size

  const ctx = output.getContext("2d")
  if (!ctx) {
    return source
  }

  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(
    source,
    Math.floor((size - source.width) / 2),
    Math.floor((size - source.height) / 2),
  )
  return output
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

export function printStudentQrCanvas(canvas: HTMLCanvasElement, studentId: string) {
  const padded = createPaddedQrCanvas(canvas, DOWNLOAD_PADDING_PX)
  const dataUrl = padded.toDataURL("image/png")
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=480,height=640")
  if (!printWindow) {
    throw new Error("Pop-up blocked. Allow pop-ups to print the QR code.")
  }

  printWindow.document.write(`<!doctype html>
<html>
  <head>
    <title>QR ${studentId}</title>
    <style>
      @page { margin: 16mm; }
      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: #fff;
        color: #000;
      }
      img {
        width: 280px;
        height: 280px;
        image-rendering: pixelated;
        border: 0;
      }
      p {
        margin-top: 16px;
        font-size: 18px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
    </style>
  </head>
  <body>
    <img src="${dataUrl}" alt="QR code for ${studentId}" />
    <p>${studentId}</p>
    <script>
      window.onload = function () {
        window.focus();
        window.print();
      };
    </script>
  </body>
</html>`)
  printWindow.document.close()
}
