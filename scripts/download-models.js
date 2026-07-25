/**
 * Downloads the face-api.js model weights needed by the app into public/models:
 *   - ssd_mobilenetv1_model
 *   - face_landmark_68_model
 *   - face_recognition_model
 *
 * Usage:  node scripts/download-models.js
 * Override the source with MODELS_BASE_URL env var if GitHub is unreachable.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL =
  process.env.MODELS_BASE_URL ||
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

const MODELS = ["ssd_mobilenetv1_model", "face_landmark_68_model", "face_recognition_model"]

const OUTPUT_DIR = path.join(__dirname, "..", "public", "models")

async function download(fileName) {
  const url = `${BASE_URL}/${fileName}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  const target = path.join(OUTPUT_DIR, fileName)
  fs.writeFileSync(target, buffer)
  console.log(`  saved ${fileName} (${(buffer.length / 1024).toFixed(0)} KB)`)
  return buffer
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  console.log(`Downloading face-api.js models from ${BASE_URL}`)
  console.log(`Output: ${OUTPUT_DIR}\n`)

  for (const model of MODELS) {
    const manifestName = `${model}-weights_manifest.json`
    console.log(`${model}:`)
    const manifestBuffer = await download(manifestName)

    // The manifest lists the binary shard files each model needs.
    const manifest = JSON.parse(manifestBuffer.toString("utf-8"))
    const shardPaths = new Set()
    for (const group of manifest) {
      for (const shard of group.paths || []) {
        shardPaths.add(shard)
      }
    }

    for (const shard of shardPaths) {
      await download(shard)
    }
  }

  console.log("\nAll models downloaded successfully.")
}

main().catch((error) => {
  console.error(`\nDownload failed: ${error.message}`)
  process.exitCode = 1
})
