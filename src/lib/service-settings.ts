import { SERVICE_INFO, SERVICE_TERMS } from "@/lib/service-info"

export type ServiceSettings = {
  name: string
  city: string
  address: string
  phone: string
  terms: string
  warranty: string
}

export const SETTINGS_KEY = "keltison-service-settings"

export const defaultServiceSettings: ServiceSettings = {
  name: SERVICE_INFO.name,
  city: SERVICE_INFO.city,
  address: SERVICE_INFO.address,
  phone: SERVICE_INFO.phone,
  terms: SERVICE_TERMS.join("\n"),
  warranty: SERVICE_INFO.warrantyTerms.join("\n"),
}

export function readServiceSettings(): ServiceSettings {
  if (typeof window === "undefined") return defaultServiceSettings
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultServiceSettings
    const parsed = JSON.parse(raw) as Partial<ServiceSettings>
    return { ...defaultServiceSettings, ...parsed }
  } catch {
    return defaultServiceSettings
  }
}

export function writeServiceSettings(settings: ServiceSettings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function linesOf(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

export function headerLine(settings: ServiceSettings) {
  return `${settings.name}, ${settings.city} / ${settings.address} / ${settings.phone}`
}
