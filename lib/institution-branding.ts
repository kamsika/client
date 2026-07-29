import type { CSSProperties } from "react"

import type { Institution } from "@/types"

export const AHMS_DEFAULT_BRANDING = {
  logoUrl: null as string | null,
  primaryColor: "#0047AB",
  secondaryColor: "#FFFFFF",
  accentColor: "#F9BF15",
  themePreset: "royal_blue",
} as const

export type ThemePresetId =
  | "royal_blue"
  | "green_education"
  | "purple_modern"
  | "dark"
  | "light"

export type InstitutionBranding = {
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  themePreset: ThemePresetId | string
}

export const THEME_PRESETS: Array<{
  id: ThemePresetId
  label: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
}> = [
  {
    id: "royal_blue",
    label: "Royal Blue",
    primaryColor: "#0047AB",
    secondaryColor: "#FFFFFF",
    accentColor: "#F9BF15",
  },
  {
    id: "green_education",
    label: "Green Education",
    primaryColor: "#059669",
    secondaryColor: "#F0FDF4",
    accentColor: "#34D399",
  },
  {
    id: "purple_modern",
    label: "Purple Modern",
    primaryColor: "#7C3AED",
    secondaryColor: "#FAF5FF",
    accentColor: "#C084FC",
  },
  {
    id: "dark",
    label: "Dark",
    primaryColor: "#05082E",
    secondaryColor: "#1E293B",
    accentColor: "#00AAE4",
  },
  {
    id: "light",
    label: "Light",
    primaryColor: "#2563EB",
    secondaryColor: "#FFFFFF",
    accentColor: "#FACC15",
  },
]

export const MAX_LOGO_BYTES = 512 * 1024

export const ACCEPTED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
]

export function isValidHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(String(value).trim())
}

const NAMED_COLOR_HEX: Record<string, string> = {
  white: "#FFFFFF",
  black: "#000000",
  blue: "#2563EB",
  red: "#EF4444",
  green: "#22C55E",
  yellow: "#FACC15",
}

function expandShortHex(value: string): string | null {
  const match = /^#([0-9A-Fa-f]{3})$/.exec(value.trim())
  if (!match) return null
  const [r, g, b] = match[1]
  return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
}

export function normalizeColor(
  color: string | null | undefined,
  fallback: string = AHMS_DEFAULT_BRANDING.primaryColor,
): string {
  const safeFallback = isValidHexColor(fallback)
    ? fallback.toUpperCase()
    : AHMS_DEFAULT_BRANDING.primaryColor

  if (color == null) return safeFallback
  const trimmed = String(color).trim()
  if (!trimmed || trimmed.toLowerCase() === "transparent") return safeFallback

  if (isValidHexColor(trimmed)) return trimmed.toUpperCase()

  const shortHex = expandShortHex(trimmed)
  if (shortHex) return shortHex

  const named = NAMED_COLOR_HEX[trimmed.toLowerCase()]
  if (named) return named

  return safeFallback
}

export function normalizeBranding(branding: InstitutionBranding): InstitutionBranding {
  return {
    ...branding,
    primaryColor: normalizeColor(
      branding.primaryColor,
      AHMS_DEFAULT_BRANDING.primaryColor,
    ),
    secondaryColor: normalizeColor(
      branding.secondaryColor,
      AHMS_DEFAULT_BRANDING.secondaryColor,
    ),
    accentColor: normalizeColor(branding.accentColor, AHMS_DEFAULT_BRANDING.accentColor),
  }
}

export function brandingFromInstitution(
  institution: Institution | null | undefined,
): InstitutionBranding {
  if (!institution) {
    return normalizeBranding({ ...AHMS_DEFAULT_BRANDING })
  }
  return normalizeBranding({
    logoUrl: institution.logo_url ?? institution.logo ?? null,
    primaryColor: institution.primary_color ?? AHMS_DEFAULT_BRANDING.primaryColor,
    secondaryColor: institution.secondary_color ?? AHMS_DEFAULT_BRANDING.secondaryColor,
    accentColor: institution.accent_color ?? AHMS_DEFAULT_BRANDING.accentColor,
    themePreset: institution.theme_preset ?? AHMS_DEFAULT_BRANDING.themePreset,
  })
}

export function brandingCssVariables(branding: InstitutionBranding): CSSProperties {
  const normalized = normalizeBranding(branding)
  return {
    ["--brand-primary" as string]: normalized.primaryColor,
    ["--brand-secondary" as string]: normalized.secondaryColor,
    ["--brand-accent" as string]: normalized.accentColor,
  }
}

export function readLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      reject(new Error("Logo must be PNG, JPG, JPEG, or SVG."))
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      reject(new Error("Logo must be 512 KB or smaller."))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
      } else {
        reject(new Error("Failed to read logo file."))
      }
    }
    reader.onerror = () => reject(new Error("Failed to read logo file."))
    reader.readAsDataURL(file)
  })
}

export function brandingStorageKey(institutionId: number) {
  return `ahms_branding_${institutionId}`
}

export function cacheBranding(institutionId: number, branding: InstitutionBranding) {
  if (typeof window === "undefined") return
  localStorage.setItem(brandingStorageKey(institutionId), JSON.stringify(branding))
}

export function readCachedBranding(institutionId: number): InstitutionBranding | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(brandingStorageKey(institutionId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as InstitutionBranding
    return normalizeBranding(parsed)
  } catch {
    return null
  }
}
