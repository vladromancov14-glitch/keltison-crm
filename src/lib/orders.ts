export const ORDER_STATUSES = [
  { value: "received", label: "Принят" },
  { value: "in_progress", label: "В работе" },
  { value: "ready", label: "Готов" },
  { value: "issued", label: "Выдан" },
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]["value"]

export function statusLabel(status: string) {
  return ORDER_STATUSES.find((item) => item.value === status)?.label ?? status
}

export type OrderItemRow = {
  id?: string
  part_id?: string | null
  line_no: number | null
  name: string | null
  article: string | null
  warranty_days: number | null
  price: number | string | null
  discount: number | string | null
  quantity: number | string | null
}

export function itemSum(item: {
  price: number | string | null
  discount: number | string | null
  quantity: number | string | null
}) {
  const price = Number(item.price ?? 0)
  const discount = Number(item.discount ?? 0)
  const quantity = Number(item.quantity ?? 0)
  if (![price, discount, quantity].every(Number.isFinite)) return 0
  return Math.max(0, price - discount) * quantity
}

export function orderStatusUrl(orderId: string) {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/status/${orderId}`
  }
  return `/status/${orderId}`
}
