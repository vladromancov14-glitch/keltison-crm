export type MasterRow = {
  id: string
  name: string
  default_percent: number | string
  created_at: string | null
}

export function masterPercentValue(value: number | string | null | undefined) {
  if (value == null || value === "") return 40
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return 40
  return Math.min(100, Math.max(0, amount))
}
