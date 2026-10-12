"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { FileBadge, Pencil, Printer, Trash2 } from "lucide-react"
import { ReceiptAct, type ReceiptActData } from "@/components/ReceiptAct"
import { WorkAct, type WorkActData } from "@/components/WorkAct"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { itemSum, statusLabel, type OrderItemRow } from "@/lib/orders"
import { normalizePhone, phoneLookupKey } from "@/lib/phone"
import { readServiceSettings, type ServiceSettings } from "@/lib/service-settings"
import { supabase } from "@/lib/supabase"

type ClientOrder = {
  id: string
  order_number: number
  device_type: string | null
  brand_model: string | null
  serial_number: string | null
  appearance: string | null
  kit: string | null
  declared_defect: string | null
  repair_cost: number | string | null
  prepayment: number | string | null
  estimated_ready_at: string | null
  receiver_notes: string | null
  recommendations: string | null
  guarantee_days: number | string | null
  master_id: string | null
  master_percent: number | string | null
  status: string
  created_at: string | null
  order_items?: OrderItemRow[] | null
}

type RawClient = {
  id: string
  full_name: string | null
  phone: string | null
  notes: string | null
  created_at: string | null
  orders: ClientOrder[] | null
}

type UniqueClient = {
  id: string
  fullName: string
  phone: string
  notes: string | null
  visits: number
  revenue: number
  lastVisit: string | null
  orders: ClientOrder[]
}

type PrintJob =
  | { kind: "receipt"; data: ReceiptActData; settings: ServiceSettings }
  | { kind: "work"; data: WorkActData; settings: ServiceSettings }

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
})

const CLIENT_SELECT =
  "id, full_name, phone, notes, created_at, orders(id, order_number, device_type, brand_model, serial_number, appearance, kit, declared_defect, repair_cost, prepayment, estimated_ready_at, receiver_notes, recommendations, guarantee_days, master_id, master_percent, status, created_at, order_items(id, part_id, line_no, name, article, warranty_days, price, discount, quantity))"

const CLIENT_SELECT_BASIC =
  "id, full_name, phone, notes, created_at, orders(id, order_number, device_type, brand_model, serial_number, declared_defect, repair_cost, status, created_at)"

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value))
}

function amountOf(value: number | string | null | undefined) {
  if (value == null || value === "") return 0
  const amount = typeof value === "number" ? value : Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function orderTotal(order: ClientOrder) {
  if (order.order_items?.length) {
    return order.order_items.reduce((sum, item) => sum + itemSum(item), 0)
  }
  return amountOf(order.repair_cost)
}

function deviceKey(order: ClientOrder) {
  const serial = order.serial_number?.trim().toLowerCase()
  if (serial) return `sn:${serial}`
  const device = `${order.device_type ?? ""} ${order.brand_model ?? ""}`.trim().toLowerCase()
  return device ? `dev:${device}` : ""
}

function visitMarks(orders: ClientOrder[]) {
  const sorted = [...orders].sort(
    (a, b) => Date.parse(a.created_at ?? "") - Date.parse(b.created_at ?? "")
  )
  const marks = new Map<string, string[]>()
  sorted.forEach((order, index) => {
    const key = deviceKey(order)
    const tags: string[] = []
    if (key) {
      const previous = [...sorted.slice(0, index)].reverse().find((item) => deviceKey(item) === key)
      if (previous) {
        const days =
          (Date.parse(order.created_at ?? "") - Date.parse(previous.created_at ?? "")) /
          86_400_000
        if (
          Number.isFinite(days) &&
          days >= 0 &&
          days <= 30 &&
          (previous.status === "issued" || previous.status === "ready")
        ) {
          tags.push("Гарантийный ремонт")
        } else {
          tags.push("Повторное обращение")
        }
      }
    }
    marks.set(order.id, tags)
  })
  return marks
}

function groupClients(rows: RawClient[]): UniqueClient[] {
  const groups = new Map<string, RawClient[]>()
  for (const client of rows) {
    const key = phoneLookupKey(client.phone ?? "") || `id:${client.id}`
    const bucket = groups.get(key) ?? []
    bucket.push(client)
    groups.set(key, bucket)
  }

  return [...groups.values()]
    .map((bucket) => {
      const orders = bucket
        .flatMap((client) => client.orders ?? [])
        .sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""))
      const primary = [...bucket].sort((a, b) => (b.orders?.length ?? 0) - (a.orders?.length ?? 0))[0]
      const named = bucket.find((client) => client.full_name?.trim()) ?? primary
      const lastVisit = orders[0]?.created_at ?? null
      const revenue = orders
        .filter((order) => order.status === "issued")
        .reduce((sum, order) => sum + orderTotal(order), 0)
      return {
        id: primary.id,
        fullName: named.full_name?.trim() || "Без имени",
        phone: normalizePhone(primary.phone ?? "") ?? primary.phone ?? "—",
        notes: bucket.map((client) => client.notes?.trim()).filter(Boolean).join("\n") || null,
        visits: orders.length,
        revenue,
        lastVisit,
        orders,
      }
    })
    .sort((a, b) => Date.parse(b.lastVisit ?? "") - Date.parse(a.lastVisit ?? ""))
}

/** Client print payload only — never include cost_price, master_percent, salary or profit. */
function toPrint(client: UniqueClient, order: ClientOrder) {
  return {
    id: order.id,
    order_number: order.order_number,
    created_at: order.created_at,
    device_type: order.device_type,
    brand_model: order.brand_model,
    serial_number: order.serial_number ?? null,
    appearance: order.appearance ?? null,
    kit: order.kit ?? null,
    declared_defect: order.declared_defect,
    repair_cost: order.repair_cost,
    prepayment: order.prepayment ?? null,
    estimated_ready_at: order.estimated_ready_at ?? null,
    receiver_notes: order.receiver_notes ?? null,
    recommendations: order.recommendations ?? null,
    guarantee_days: order.guarantee_days ?? 30,
    client_name: client.fullName,
    client_phone: client.phone,
    items: order.order_items ?? [],
  }
}

export default function ClientsPage() {
  const [clients, setClients] = useState<UniqueClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<UniqueClient | null>(null)
  const [editing, setEditing] = useState<UniqueClient | null>(null)
  const [printJob, setPrintJob] = useState<PrintJob | null>(null)

  const loadClients = useCallback(async () => {
    setLoading(true)
    const full = await supabase
      .from("clients")
      .select(CLIENT_SELECT)
      .order("created_at", { ascending: false })
    const result = full.error
      ? await supabase.from("clients").select(CLIENT_SELECT_BASIC).order("created_at", { ascending: false })
      : full

    if (result.error) {
      setError(result.error.message)
      setClients([])
    } else {
      setError(null)
      setClients(groupClients((result.data ?? []) as RawClient[]))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadClients()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadClients])

  useEffect(() => {
    if (!printJob) return
    const timeout = window.setTimeout(() => {
      window.print()
      setPrintJob(null)
    }, 80)
    return () => window.clearTimeout(timeout)
  }, [printJob])

  async function deleteClient(client: UniqueClient) {
    if (!window.confirm(`Удалить клиента «${client.fullName}»? Это действие нельзя отменить.`)) {
      return
    }
    const { error: deleteError } = await supabase.from("clients").delete().eq("id", client.id)
    if (deleteError) {
      console.error(deleteError)
      alert(deleteError.message)
      setError(deleteError.message)
      return
    }
    if (selected?.id === client.id) setSelected(null)
    if (editing?.id === client.id) setEditing(null)
    await loadClients()
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const digits = phoneLookupKey(query)
    if (!needle) return clients
    return clients.filter((client) => {
      const name = client.fullName.toLowerCase()
      const phone = phoneLookupKey(client.phone)
      return name.includes(needle) || (digits.length > 0 && phone.includes(digits))
    })
  }, [clients, query])

  const marks = selected ? visitMarks(selected.orders) : new Map<string, string[]>()

  return (
    <>
      <section className="flex flex-col gap-4 p-6 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Клиенты</h1>
            <p className="text-sm text-muted-foreground">
              Один клиент на телефон. Нажмите строку, чтобы открыть историю заказов.
            </p>
          </div>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по имени или телефону"
            className="max-w-sm"
          />
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
                <TableHead>Клиент</TableHead>
                <TableHead>Визиты</TableHead>
                <TableHead>Выторг</TableHead>
                <TableHead>Последнее обращение</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Загрузка…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Клиенты не найдены
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(client)}
                  >
                    <TableCell>
                      <div className="font-medium">{client.fullName}</div>
                      <div className="text-sm text-muted-foreground">{client.phone}</div>
                    </TableCell>
                    <TableCell>Всего визитов: {client.visits}</TableCell>
                    <TableCell>{money.format(client.revenue)}</TableCell>
                    <TableCell>{formatDate(client.lastVisit)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Редактировать ${client.fullName}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            setEditing(client)
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Удалить клиента"
                          aria-label={`Удалить ${client.fullName}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            void deleteClient(client)
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            {selected ? (
              <>
                <DialogHeader>
                  <DialogTitle>{selected.fullName}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  {selected.phone} · Всего визитов: {selected.visits} · Выторг:{" "}
                  {money.format(selected.revenue)}
                </p>
                {selected.notes ? <p className="text-sm">{selected.notes}</p> : null}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>№</TableHead>
                      <TableHead>Дата</TableHead>
                      <TableHead>Устройство</TableHead>
                      <TableHead>Неисправность</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Стоимость</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.orders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-muted-foreground">
                          Заказов нет
                        </TableCell>
                      </TableRow>
                    ) : (
                      selected.orders.map((order) => {
                        const tags = marks.get(order.id) ?? []
                        return (
                          <TableRow key={order.id}>
                            <TableCell>{order.order_number}</TableCell>
                            <TableCell>{formatDate(order.created_at)}</TableCell>
                            <TableCell>
                              {[order.device_type, order.brand_model].filter(Boolean).join(" ") || "—"}
                            </TableCell>
                            <TableCell className="max-w-48 whitespace-normal">
                              {order.declared_defect || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col items-start gap-1">
                                <Badge variant="secondary">{statusLabel(order.status)}</Badge>
                                {tags.map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant={tag === "Гарантийный ремонт" ? "outline" : "default"}
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>{money.format(orderTotal(order))}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title="Печать приемной квитанции"
                                  aria-label={`Печать квитанции № ${order.order_number}`}
                                  onClick={() =>
                                    setPrintJob({
                                      kind: "receipt",
                                      data: toPrint(selected, order),
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
                                  title="Печать акта выполненных работ"
                                  aria-label={`Печать акта № ${order.order_number}`}
                                  onClick={() =>
                                    setPrintJob({
                                      kind: "work",
                                      data: toPrint(selected, order),
                                      settings: readServiceSettings(),
                                    })
                                  }
                                >
                                  <FileBadge />
                                </Button>
                                <Button variant="outline" size="sm" render={<Link href={`/?order=${order.id}`} />}>
                                  К заказу
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <ClientEditor
          client={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          onSaved={() => {
            void loadClients()
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

function ClientEditor({
  client,
  onOpenChange,
  onSaved,
}: {
  client: UniqueClient | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  return (
    <Dialog open={client != null} onOpenChange={onOpenChange}>
      <DialogContent>
        {client ? (
          <ClientForm
            key={client.id}
            client={client}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ClientForm({
  client,
  onClose,
  onSaved,
}: {
  client: UniqueClient
  onClose: () => void
  onSaved: () => void
}) {
  const [fullName, setFullName] = useState(client.fullName)
  const [phone, setPhone] = useState(client.phone === "—" ? "" : client.phone)
  const [notes, setNotes] = useState(client.notes ?? "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    const normalized = phone.trim() ? normalizePhone(phone) : null
    if (phone.trim() && !normalized) {
      setError("Укажите телефон в формате +7 и 10 цифр.")
      return
    }
    setPending(true)
    const { error: saveError } = await supabase
      .from("clients")
      .update({
        full_name: fullName.trim(),
        phone: normalized,
        notes: notes.trim() || null,
      })
      .eq("id", client.id)
    setPending(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <form className="grid gap-3" onSubmit={save}>
      <DialogHeader>
        <DialogTitle>Карточка клиента</DialogTitle>
      </DialogHeader>
      <label className="grid gap-1.5 text-sm font-medium">
        ФИО
        <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Телефон
        <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Заметки
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none"
        />
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Сохранение…" : "Сохранить"}
        </Button>
      </DialogFooter>
    </form>
  )
}
