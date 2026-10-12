import { itemSum, type OrderItemRow } from "@/lib/orders"

export type FinancePeriod = "today" | "week" | "month" | "year" | "all"

export const FINANCE_PERIODS: { value: FinancePeriod; label: string }[] = [
  { value: "today", label: "Сегодня" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "year", label: "Год" },
  { value: "all", label: "Всё время" },
]

export type FinanceOrderItem = OrderItemRow & {
  parts?:
    | { purchase_price: number | string | null }
    | { purchase_price: number | string | null }[]
    | null
}

export type FinanceOrder = {
  id: string
  order_number: number
  status: string
  created_at: string | null
  repair_cost: number | string | null
  cost_price?: number | string | null
  master_id: string | null
  master_percent: number | string | null
  masters?:
    | { name: string | null; default_percent: number | string | null }
    | { name: string | null; default_percent: number | string | null }[]
    | null
  order_items?: FinanceOrderItem[] | null
}

export type MasterFinanceRow = {
  masterId: string | null
  masterName: string
  orderCount: number
  revenue: number
  partsCost: number
  margin: number
  masterPercent: number
  masterPay: number
  serviceProfit: number
}

function money(value: number | string | null | undefined) {
  if (value == null || value === "") return 0
  const amount = typeof value === "number" ? value : Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function masterOf(order: FinanceOrder) {
  if (!order.masters) return null
  return Array.isArray(order.masters) ? (order.masters[0] ?? null) : order.masters
}

function partOf(item: FinanceOrderItem) {
  if (!item.parts) return null
  return Array.isArray(item.parts) ? (item.parts[0] ?? null) : item.parts
}

export function orderRevenue(order: FinanceOrder) {
  const itemsTotal = (order.order_items ?? []).reduce(
    (sum, item) => sum + itemSum(item),
    0
  )
  if (itemsTotal > 0) return itemsTotal
  return money(order.repair_cost)
}

export function orderWarehousePartsCost(order: FinanceOrder) {
  return (order.order_items ?? []).reduce((sum, item) => {
    const part = partOf(item)
    if (!part) return sum
    const qty = money(item.quantity ?? 1)
    return sum + money(part.purchase_price) * qty
  }, 0)
}

/** Manual cost_price + складской закуп по связанным запчастям. */
export function orderPartsCost(order: FinanceOrder) {
  return money(order.cost_price) + orderWarehousePartsCost(order)
}

export function orderMasterPercent(order: FinanceOrder) {
  if (order.master_percent != null && order.master_percent !== "") {
    return money(order.master_percent)
  }
  const master = masterOf(order)
  return money(master?.default_percent ?? 0)
}

export function orderMargin(order: FinanceOrder) {
  return Math.max(0, orderRevenue(order) - orderPartsCost(order))
}

export function orderMasterPay(order: FinanceOrder) {
  return (orderMargin(order) * orderMasterPercent(order)) / 100
}

export function orderServiceProfit(order: FinanceOrder) {
  return orderMargin(order) - orderMasterPay(order)
}

export function periodStart(period: FinancePeriod, now = new Date()) {
  if (period === "all") return null
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (period === "today") return start
  if (period === "week") {
    const day = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - day)
    return start
  }
  if (period === "month") {
    start.setDate(1)
    return start
  }
  start.setMonth(0, 1)
  return start
}

export function isCompletedOrder(status: string) {
  return status === "ready" || status === "issued"
}

export function inPeriod(createdAt: string | null, period: FinancePeriod, now = new Date()) {
  if (period === "all") return true
  if (!createdAt) return false
  const start = periodStart(period, now)
  if (!start) return true
  return Date.parse(createdAt) >= start.getTime()
}

export function buildMasterFinance(
  orders: FinanceOrder[],
  period: FinancePeriod,
  now = new Date()
): MasterFinanceRow[] {
  const filtered = orders.filter(
    (order) =>
      isCompletedOrder(order.status) && inPeriod(order.created_at, period, now)
  )

  const groups = new Map<
    string,
    {
      masterId: string | null
      masterName: string
      percents: number[]
      orderCount: number
      revenue: number
      partsCost: number
      margin: number
      masterPay: number
      serviceProfit: number
    }
  >()

  for (const order of filtered) {
    const master = masterOf(order)
    const masterId = order.master_id
    const key = masterId ?? "none"
    const masterName = master?.name?.trim() || "Без мастера"
    const bucket = groups.get(key) ?? {
      masterId,
      masterName,
      percents: [],
      orderCount: 0,
      revenue: 0,
      partsCost: 0,
      margin: 0,
      masterPay: 0,
      serviceProfit: 0,
    }

    const revenue = orderRevenue(order)
    const partsCost = orderPartsCost(order)
    const margin = Math.max(0, revenue - partsCost)
    const percent = orderMasterPercent(order)
    const masterPay = (margin * percent) / 100
    const serviceProfit = margin - masterPay

    bucket.orderCount += 1
    bucket.revenue += revenue
    bucket.partsCost += partsCost
    bucket.margin += margin
    bucket.masterPay += masterPay
    bucket.serviceProfit += serviceProfit
    bucket.percents.push(percent)
    groups.set(key, bucket)
  }

  return [...groups.values()]
    .map((row) => ({
      masterId: row.masterId,
      masterName: row.masterName,
      orderCount: row.orderCount,
      revenue: row.revenue,
      partsCost: row.partsCost,
      margin: row.margin,
      masterPercent:
        row.percents.length > 0
          ? row.percents.reduce((a, b) => a + b, 0) / row.percents.length
          : 0,
      masterPay: row.masterPay,
      serviceProfit: row.serviceProfit,
    }))
    .sort((a, b) => b.masterPay - a.masterPay || a.masterName.localeCompare(b.masterName, "ru"))
}
