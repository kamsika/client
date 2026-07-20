export async function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function downloadFromResponse(response: Response, fallbackFilename: string) {
  const disposition = response.headers.get("Content-Disposition")
  let filename = fallbackFilename
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/)
    if (match) filename = match[1]
  }
  const blob = await response.blob()
  downloadBlob(blob, filename)
}
