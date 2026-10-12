export function formatPrintDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

export function formatPrintTime(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatPrintDateTime(value: string | null) {
  if (!value) return "—"
  return `${formatPrintDate(value)}, ${formatPrintTime(value)}`
}

export function formatPrintMoney(value: number | string | null | undefined) {
  if (value == null || value === "") return "—"
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return "—"
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(amount)
}

export function textOrDash(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : "—"
}
