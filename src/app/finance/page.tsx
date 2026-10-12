"use client"

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  buildMasterFinance,
  FINANCE_PERIODS,
  type FinanceOrder,
  type FinancePeriod,
} from "@/lib/finance"
import { supabase } from "@/lib/supabase"

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
})

function rub(value: number) {
  return money.format(value)
}

const FINANCE_SELECT =
  "id, order_number, status, created_at, repair_cost, cost_price, master_id, master_percent, masters(name, default_percent), order_items(id, name, price, discount, quantity, parts(purchase_price))"

export default function FinancePage() {
  const [orders, setOrders] = useState<FinanceOrder[]>([])
  const [period, setPeriod] = useState<FinancePeriod>("month")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from("orders")
      .select(FINANCE_SELECT)
      .in("status", ["ready", "issued"])
      .order("created_at", { ascending: false })

    if (loadError) {
      setError(
        /master|parts|schema cache|column|relation/i.test(loadError.message)
          ? "Выполните обновлённый supabase_schema.sql: нужны masters, master_id и master_percent."
          : loadError.message
      )
      setOrders([])
    } else {
      setError(null)
      setOrders((data ?? []) as FinanceOrder[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadOrders()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadOrders])

  const rows = useMemo(() => buildMasterFinance(orders, period), [orders, period])
  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          orderCount: sum.orderCount + row.orderCount,
          revenue: sum.revenue + row.revenue,
          partsCost: sum.partsCost + row.partsCost,
          margin: sum.margin + row.margin,
          masterPay: sum.masterPay + row.masterPay,
          serviceProfit: sum.serviceProfit + row.serviceProfit,
        }),
        { orderCount: 0, revenue: 0, partsCost: 0, margin: 0, masterPay: 0, serviceProfit: 0 }
      ),
    [rows]
  )

  return (
    <section className="flex flex-col gap-4 p-6 print:hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Финансы</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Готовые и выданные заказы. Маржа = итоговая цена − затраты на запчасти (`cost_price` и
            складской закуп). Зарплата мастера — его процент от маржи; остаток — прибыль сервиса.
            Закуп, проценты и зарплата не печатаются в клиентских бланках.
          </p>
        </div>
        <label className="grid gap-1.5 text-sm font-medium">
          Период
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as FinancePeriod)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {FINANCE_PERIODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Мастер</TableHead>
              <TableHead>Заказов</TableHead>
              <TableHead>Сумма ремонтов</TableHead>
              <TableHead>Запчасти (закуп)</TableHead>
              <TableHead>Маржа</TableHead>
              <TableHead>Средний %</TableHead>
              <TableHead>Зарплата</TableHead>
              <TableHead>Прибыль сервиса</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8}>Загрузка…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>За выбранный период готовых заказов нет.</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.masterId ?? "none"}>
                  <TableCell>{row.masterName}</TableCell>
                  <TableCell>{row.orderCount}</TableCell>
                  <TableCell>{rub(row.revenue)}</TableCell>
                  <TableCell>{rub(row.partsCost)}</TableCell>
                  <TableCell>{rub(row.margin)}</TableCell>
                  <TableCell>{Math.round(row.masterPercent)}%</TableCell>
                  <TableCell>{rub(row.masterPay)}</TableCell>
                  <TableCell>{rub(row.serviceProfit)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {rows.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell>Итого</TableCell>
                <TableCell>{totals.orderCount}</TableCell>
                <TableCell>{rub(totals.revenue)}</TableCell>
                <TableCell>{rub(totals.partsCost)}</TableCell>
                <TableCell>{rub(totals.margin)}</TableCell>
                <TableCell />
                <TableCell>{rub(totals.masterPay)}</TableCell>
                <TableCell>{rub(totals.serviceProfit)}</TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
    </section>
  )
}
