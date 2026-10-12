"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { FileBadge, Pencil, Printer, Trash2 } from "lucide-react"
import { CreateOrderModal } from "@/components/CreateOrderModal"
import { EditOrderModal, type EditableOrder } from "@/components/EditOrderModal"
import { ReceiptAct, type ReceiptActData } from "@/components/ReceiptAct"
import { WorkAct, type WorkActData } from "@/components/WorkAct"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ORDER_STATUSES, type OrderItemRow, type OrderStatus } from "@/lib/orders"
import { readServiceSettings, type ServiceSettings } from "@/lib/service-settings"
import { supabase } from "@/lib/supabase"

type ClientInfo = {
  full_name: string | null
  phone: string | null
}

type OrderRow = EditableOrder & {
  order_number: number
  status: string
  created_at: string | null
  clients: ClientInfo | ClientInfo[] | null
  order_items: OrderItemRow[] | null
}

type PrintJob =
  | { kind: "receipt"; data: ReceiptActData; settings: ServiceSettings }
  | { kind: "work"; data: WorkActData; settings: ServiceSettings }

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
})

const ORDER_SELECT =
  "id, order_number, client_id, device_type, brand_model, serial_number, declared_defect, appearance, kit, repair_cost, cost_price, prepayment, estimated_ready_at, receiver_notes, recommendations, guarantee_days, master_id, master_percent, status, created_at, clients(full_name, phone), order_items(id, part_id, line_no, name, article, warranty_days, price, discount, quantity)"

const ORDER_SELECT_BASIC =
  "id, order_number, client_id, device_type, brand_model, serial_number, declared_defect, appearance, repair_cost, status, created_at, clients(full_name, phone)"

function clientOf(clients: OrderRow["clients"]) {
  if (!clients) return null
  return Array.isArray(clients) ? (clients[0] ?? null) : clients
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value))
}

function formatMoney(value: number | string | null) {
  if (value == null || value === "") return "—"
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return "—"
  return money.format(amount)
}

/** Client print payload only — never include cost_price, master_percent, salary or profit. */
function toPrintBase(order: OrderRow) {
  const client = clientOf(order.clients)
  return {
    id: order.id,
    order_number: order.order_number,
    created_at: order.created_at,
    device_type: order.device_type,
    brand_model: order.brand_model,
    serial_number: order.serial_number,
    appearance: order.appearance,
    kit: order.kit,
    declared_defect: order.declared_defect,
    repair_cost: order.repair_cost,
    prepayment: order.prepayment,
    estimated_ready_at: order.estimated_ready_at,
    receiver_notes: order.receiver_notes,
    recommendations: order.recommendations,
    guarantee_days: order.guarantee_days ?? 30,
    client_name: client?.full_name ?? null,
    client_phone: client?.phone ?? null,
    items: order.order_items ?? [],
  }
}

 function HomeContent() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<OrderRow | null>(null)
  const [printJob, setPrintJob] = useState<PrintJob | null>(null)
  const searchParams = useSearchParams()
  const openedOrder = useRef<string | null>(null)
  const focusOrderId = searchParams.get("order")

  const loadOrders = useCallback(async () => {
    setLoading(true)
    const full = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .order("created_at", { ascending: false })

    const result = full.error
      ? await supabase
          .from("orders")
          .select(ORDER_SELECT_BASIC)
          .order("created_at", { ascending: false })
      : full

    if (result.error) {
      setError(result.error.message)
      setOrders([])
    } else {
      setError(
        full.error &&
          /order_items|schema cache|column|kit|prepayment|notes/i.test(full.error.message)
          ? "Выполните обновлённый supabase_schema.sql: нужны поля комплектации, предоплаты и таблица order_items."
          : null
      )
      setOrders(
        ((result.data ?? []) as OrderRow[]).map((order) => ({
          ...order,
          kit: order.kit ?? null,
          prepayment: order.prepayment ?? null,
          estimated_ready_at: order.estimated_ready_at ?? null,
          receiver_notes: order.receiver_notes ?? null,
          recommendations: order.recommendations ?? null,
          guarantee_days: order.guarantee_days ?? 30,
          cost_price: order.cost_price ?? 0,
          master_id: order.master_id ?? null,
          master_percent: order.master_percent ?? null,
          order_items: order.order_items ?? [],
        }))
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadOrders()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadOrders])

  useEffect(() => {
    if (!focusOrderId || openedOrder.current === focusOrderId) return
    const found = orders.find((order) => order.id === focusOrderId)
    if (!found) return
    openedOrder.current = focusOrderId
    setEditing(found)
  }, [focusOrderId, orders])

  useEffect(() => {
    if (!printJob) return
    const timeout = window.setTimeout(() => {
      window.print()
      setPrintJob(null)
    }, 80)
    return () => window.clearTimeout(timeout)
  }, [printJob])

  async function deleteOrder(order: OrderRow) {
    if (!window.confirm(`Удалить заказ №${order.order_number}? Это действие нельзя отменить.`)) {
      return
    }
    const { error: deleteError } = await supabase.from("orders").delete().eq("id", order.id)
    if (deleteError) {
      console.error(deleteError)
      alert(deleteError.message)
      return
    }
    if (editing?.id === order.id) setEditing(null)
    await loadOrders()
  }

  async function changeStatus(order: OrderRow, status: OrderStatus) {
    setOrders((current) =>
      current.map((item) => (item.id === order.id ? { ...item, status } : item))
    )
    const { error: saveError } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", order.id)
    if (saveError) {
      setError(saveError.message)
      void loadOrders()
    }
  }

  return (
    <>
      <section className="flex flex-col gap-4 p-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Раздел заказов</h1>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Создать заказ
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Номер</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Устройство</TableHead>
                <TableHead>Неисправность</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground">
                    Загрузка…
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground">
                    Заказов пока нет
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => {
                  const client = clientOf(order.clients)
                  const device = [order.device_type, order.brand_model]
                    .filter(Boolean)
                    .join(" ")
                  const printBase = toPrintBase(order)
                  return (
                    <TableRow key={order.id}>
                      <TableCell>{order.order_number}</TableCell>
                      <TableCell>{formatDate(order.created_at)}</TableCell>
                      <TableCell>{client?.full_name || "—"}</TableCell>
                      <TableCell>{client?.phone || "—"}</TableCell>
                      <TableCell>{device || "—"}</TableCell>
                      <TableCell className="max-w-64 whitespace-normal">
                        {order.declared_defect || "—"}
                      </TableCell>
                      <TableCell>
                        <select
                          aria-label={`Статус заказа ${order.order_number}`}
                          value={order.status}
                          onChange={(event) =>
                            void changeStatus(order, event.target.value as OrderStatus)
                          }
                          className="status-select h-8 rounded-lg border border-input px-2 text-sm"
                          style={{
                            color: "#0f172a",
                            backgroundColor: "#ffffff",
                            colorScheme: "light",
                          }}
                        >
                          {ORDER_STATUSES.map((item) => (
                            <option
                              key={item.value}
                              value={item.value}
                              style={{
                                color: "#0f172a",
                                backgroundColor: "#ffffff",
                              }}
                            >
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>{formatMoney(order.repair_cost)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Редактировать заказ"
                            aria-label={`Редактировать заказ № ${order.order_number}`}
                            onClick={() => setEditing(order)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Печать приемной квитанции"
                            aria-label={`Печать приемной квитанции № ${order.order_number}`}
                            onClick={() =>
                              setPrintJob({
                                kind: "receipt",
                                data: printBase,
                                settings: readServiceSettings(),
                              })
                            }
                          >
                            <Printer />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Удалить заказ"
                            aria-label={`Удалить заказ № ${order.order_number}`}
                            onClick={() => void deleteOrder(order)}
                          >
                            <Trash2 />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Печать акта выполненных работ"
                            aria-label={`Печать акта выполненных работ № ${order.order_number}`}
                            onClick={() =>
                              setPrintJob({
                                kind: "work",
                                data: printBase,
                                settings: readServiceSettings(),
                              })
                            }
                          >
                            <FileBadge />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <CreateOrderModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => {
            void loadOrders()
          }}
        />
        <EditOrderModal
          order={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          onSaved={() => {
            void loadOrders()
          }}
        />
      </section>

      {printJob?.kind === "receipt" ? (
        <ReceiptAct order={printJob.data} settings={printJob.settings} />
      ) : null}
      {printJob?.kind === "work" ? (
        <WorkAct order={printJob.data} settings={printJob.settings} />
      ) : null}
    </>
  )
}

import { Suspense } from "react"

export default function Home() {
  return (
    <Suspense fallback={<div>Загрузка...</div>}>
      <HomeContent />
    </Suspense>
  )
}

