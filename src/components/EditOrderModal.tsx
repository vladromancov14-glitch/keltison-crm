"use client"

import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import { useLockBodyScroll } from "@/lib/use-lock-body-scroll"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { itemSum, type OrderItemRow } from "@/lib/orders"
import { normalizePhone } from "@/lib/phone"
import { masterPercentValue, type MasterRow } from "@/lib/masters"

const DEVICE_TYPES = ["Телефон", "Ноутбук", "Планшет", "Телевизор", "Другое"]
const GUARANTEE_PRESETS = [0, 14, 30, 60, 90, 180]

export type EditableOrder = {
  id: string
  client_id: string | null
  device_type: string | null
  brand_model: string | null
  serial_number: string | null
  declared_defect: string | null
  appearance: string | null
  kit: string | null
  repair_cost: number | string | null
  cost_price: number | string | null
  prepayment: number | string | null
  estimated_ready_at: string | null
  receiver_notes: string | null
  recommendations: string | null
  guarantee_days: number | string | null
  master_id: string | null
  master_percent: number | string | null
  clients: { full_name: string | null; phone: string | null } | { full_name: string | null; phone: string | null }[] | null
  order_items: OrderItemRow[] | null
}

type DraftItem = {
  key: string
  partId: string | null
  name: string
  article: string
  warranty_days: string
  price: string
  discount: string
  quantity: string
}

type StockPart = {
  id: string
  title: string | null
  sku: string | null
  article: string | null
  selling_price: number | string | null
  quantity: number | null
}

function emptyItem(): DraftItem {
  return {
    key: crypto.randomUUID(),
    partId: null,
    name: "",
    article: "",
    warranty_days: "",
    price: "",
    discount: "0",
    quantity: "1",
  }
}

function asText(value: string | number | null | undefined) {
  if (value == null) return ""
  return String(value)
}

function dateInput(value: string | null) {
  if (!value) return ""
  return value.slice(0, 10)
}

function clientOf(clients: EditableOrder["clients"]) {
  if (!clients) return null
  return Array.isArray(clients) ? (clients[0] ?? null) : clients
}

function toDrafts(items: OrderItemRow[] | null): DraftItem[] {
  if (!items?.length) {
    return [
      {
        key: crypto.randomUUID(),
        partId: null,
        name: "",
        article: "",
        warranty_days: "",
        price: "",
        discount: "0",
        quantity: "1",
      },
    ]
  }
  return [...items]
    .sort((a, b) => (a.line_no ?? 0) - (b.line_no ?? 0))
    .map((item) => ({
      key: item.id ?? crypto.randomUUID(),
      partId: item.part_id ?? null,
      name: item.name ?? "",
      article: item.article ?? "",
      warranty_days: asText(item.warranty_days),
      price: asText(item.price),
      discount: asText(item.discount ?? 0),
      quantity: asText(item.quantity ?? 1),
    }))
}

export function EditOrderModal({
  order,
  onOpenChange,
  onSaved,
}: {
  order: EditableOrder | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  useLockBodyScroll(order != null)

  return (
    <Dialog open={order != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto overscroll-contain sm:max-w-3xl">
        {order ? (
          <Editor
            key={order.id}
            order={order}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Editor({
  order,
  onClose,
  onSaved,
}: {
  order: EditableOrder
  onClose: () => void
  onSaved: () => void
}) {
  const client = clientOf(order.clients)
  const [fullName, setFullName] = useState(client?.full_name ?? "")
  const [phone, setPhone] = useState(client?.phone ?? "")
  const [deviceType, setDeviceType] = useState(order.device_type ?? "")
  const [brandModel, setBrandModel] = useState(order.brand_model ?? "")
  const [serialNumber, setSerialNumber] = useState(order.serial_number ?? "")
  const [defect, setDefect] = useState(order.declared_defect ?? "")
  const [appearance, setAppearance] = useState(order.appearance ?? "")
  const [kit, setKit] = useState(order.kit ?? "")
  const [readyAt, setReadyAt] = useState(dateInput(order.estimated_ready_at))
  const [repairCost, setRepairCost] = useState(asText(order.repair_cost))
  const [costPrice, setCostPrice] = useState(asText(order.cost_price ?? 0) || "0")
  const [prepayment, setPrepayment] = useState(asText(order.prepayment))
  const [notes, setNotes] = useState(order.receiver_notes ?? "")
  const [recommendations, setRecommendations] = useState(order.recommendations ?? "")
  const [guaranteeDays, setGuaranteeDays] = useState(
    asText(order.guarantee_days ?? 30) || "30"
  )
  const [masterId, setMasterId] = useState(order.master_id ?? "")
  const [masterPercent, setMasterPercent] = useState(asText(order.master_percent))
  const [masters, setMasters] = useState<MasterRow[]>([])
  const [items, setItems] = useState<DraftItem[]>(() => toDrafts(order.order_items))
  const [parts, setParts] = useState<StockPart[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase
      .from("parts")
      .select("id, title, sku, article, selling_price, quantity")
      .order("title")
      .then(({ data }) => {
        if (!cancelled) setParts((data ?? []) as StockPart[])
      })
    void supabase
      .from("masters")
      .select("id, name, default_percent, created_at")
      .order("name")
      .then(({ data }) => {
        if (!cancelled) setMasters((data ?? []) as MasterRow[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    )
  }

  function attachPart(partId: string) {
    const part = parts.find((item) => item.id === partId)
    if (!part) return
    if ((part.quantity ?? 0) <= 0) {
      setError("Этой детали нет на складе.")
      return
    }
    setError(null)
    const line: DraftItem = {
      key: crypto.randomUUID(),
      partId: part.id,
      name: part.title ?? "",
      article: part.sku || part.article || "",
      warranty_days: guaranteeDays || "30",
      price: asText(part.selling_price),
      discount: "0",
      quantity: "1",
    }
    setItems((current) => {
      const blank = current.length === 1 && !current[0]?.name.trim()
      return blank ? [line] : [...current, line]
    })
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    if (order.client_id) {
      const normalized = phone.trim() ? normalizePhone(phone) : null
      if (phone.trim() && !normalized) {
        setPending(false)
        setError("Укажите телефон в формате +7 и 10 цифр.")
        return
      }
      const { error: clientError } = await supabase
        .from("clients")
        .update({ full_name: fullName.trim(), phone: normalized })
        .eq("id", order.client_id)
      if (clientError) {
        setPending(false)
        setError(clientError.message)
        return
      }
    }

    const { error: orderError } = await supabase
      .from("orders")
      .update({
        device_type: deviceType.trim() || null,
        brand_model: brandModel.trim() || null,
        serial_number: serialNumber.trim() || null,
        declared_defect: defect.trim() || null,
        appearance: appearance.trim() || null,
        kit: kit.trim() || null,
        estimated_ready_at: readyAt || null,
        repair_cost: repairCost.trim() === "" ? null : Number(repairCost),
        cost_price: costPrice.trim() === "" ? 0 : Number(costPrice),
        prepayment: prepayment.trim() === "" ? 0 : Number(prepayment),
        receiver_notes: notes.trim() || null,
        recommendations: recommendations.trim() || null,
        guarantee_days:
          guaranteeDays.trim() === "" ? 30 : Number(guaranteeDays),
        master_id: masterId || null,
        master_percent:
          !masterId || masterPercent.trim() === "" ? null : Number(masterPercent),
      })
      .eq("id", order.id)

    if (orderError) {
      setPending(false)
      setError(orderError.message)
      return
    }

    const { error: deleteError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", order.id)

    if (deleteError) {
      setPending(false)
      setError(deleteError.message)
      return
    }

    const rows = items
      .filter((item) => item.name.trim())
      .map((item, index) => ({
        order_id: order.id,
        part_id: item.partId,
        line_no: index + 1,
        name: item.name.trim(),
        article: item.article.trim() || null,
        warranty_days:
          item.warranty_days.trim() === ""
            ? Number(guaranteeDays) || 30
            : Number(item.warranty_days),
        price: item.price.trim() === "" ? null : Number(item.price),
        discount: item.discount.trim() === "" ? 0 : Number(item.discount),
        quantity: item.quantity.trim() === "" ? 1 : Number(item.quantity),
      }))

    const previousQty = new Map<string, number>()
    for (const item of order.order_items ?? []) {
      if (!item.part_id) continue
      previousQty.set(
        item.part_id,
        (previousQty.get(item.part_id) ?? 0) + Number(item.quantity ?? 1)
      )
    }
    const nextQty = new Map<string, number>()
    for (const row of rows) {
      if (!row.part_id) continue
      nextQty.set(row.part_id, (nextQty.get(row.part_id) ?? 0) + Number(row.quantity ?? 1))
    }
    const partIds = new Set([...previousQty.keys(), ...nextQty.keys()])
    const stockUpdates: { id: string; quantity: number }[] = []
    if (partIds.size > 0) {
      const { data: stockRows, error: stockError } = await supabase
        .from("parts")
        .select("id, quantity, title")
        .in("id", [...partIds])
      if (stockError) {
        setPending(false)
        setError(stockError.message)
        return
      }
      for (const part of (stockRows ?? []) as StockPart[]) {
        const delta = (nextQty.get(part.id) ?? 0) - (previousQty.get(part.id) ?? 0)
        const next = (part.quantity ?? 0) - delta
        if (next < 0) {
          setPending(false)
          setError(`Недостаточно «${part.title || "детали"}» на складе.`)
          return
        }
        if (delta !== 0) stockUpdates.push({ id: part.id, quantity: next })
      }
    }

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("order_items").insert(rows)
      if (insertError) {
        setPending(false)
        setError(insertError.message)
        return
      }
    }

    for (const update of stockUpdates) {
      const { error: stockWriteError } = await supabase
        .from("parts")
        .update({ quantity: update.quantity })
        .eq("id", update.id)
      if (stockWriteError) {
        setPending(false)
        setError(stockWriteError.message)
        return
      }
    }

    setPending(false)
    onSaved()
    onClose()
  }

  return (
    <form className="grid gap-3" onSubmit={save}>
      <DialogHeader>
        <DialogTitle>Редактирование заказа</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ФИО клиента">
          <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </Field>
        <Field label="Телефон">
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="Вид устройства">
          <select
            value={deviceType}
            onChange={(event) => setDeviceType(event.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">Не выбрано</option>
            {DEVICE_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Бренд и модель">
          <Input value={brandModel} onChange={(event) => setBrandModel(event.target.value)} />
        </Field>
        <Field label="Серийный номер / IMEI">
          <Input value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} />
        </Field>
        <Field label="Ориентировочная дата готовности">
          <Input type="date" value={readyAt} onChange={(event) => setReadyAt(event.target.value)} />
        </Field>
        <Field label="Причина обращения">
          <Input value={defect} onChange={(event) => setDefect(event.target.value)} />
        </Field>
        <Field label="Внешний вид">
          <Input value={appearance} onChange={(event) => setAppearance(event.target.value)} />
        </Field>
        <Field label="Комплектация">
          <Input value={kit} onChange={(event) => setKit(event.target.value)} />
        </Field>
        <Field label="Ориентировочная стоимость">
          <Input type="number" min="0" step="0.01" value={repairCost} onChange={(event) => setRepairCost(event.target.value)} />
        </Field>
        <Field label="Затраты на запчасти / закупку (₽)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={costPrice}
            onChange={(event) => setCostPrice(event.target.value)}
          />
        </Field>
        <Field label="Предоплата">
          <Input type="number" min="0" step="0.01" value={prepayment} onChange={(event) => setPrepayment(event.target.value)} />
        </Field>
        <Field label="Заметки приёмщика">
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <Field label="Мастер">
          <select
            value={masterId}
            onChange={(event) => {
              const nextId = event.target.value
              const master = masters.find((item) => item.id === nextId)
              setMasterId(nextId)
              setMasterPercent(
                master ? String(masterPercentValue(master.default_percent)) : ""
              )
            }}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">Не назначен</option>
            {masters.map((master) => (
              <option key={master.id} value={master.id}>
                {master.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Процент мастера">
          <Input
            type="number"
            min="0"
            max="100"
            step="1"
            value={masterPercent}
            disabled={!masterId}
            onChange={(event) => setMasterPercent(event.target.value)}
          />
        </Field>
        <p className="sm:col-span-2 text-xs text-muted-foreground">
          Только для CRM: маржа = цена заказа − затраты на запчасти; зарплата мастера и прибыль
          сервиса считаются в разделе «Финансы» и не попадают в печатные бланки.
        </p>
        <Field label="Срок гарантии (дней)">
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              step="1"
              value={guaranteeDays}
              onChange={(event) => setGuaranteeDays(event.target.value)}
              list="edit-guarantee-days-presets"
            />
            <datalist id="edit-guarantee-days-presets">
              {GUARANTEE_PRESETS.map((days) => (
                <option key={days} value={days} />
              ))}
            </datalist>
            <select
              aria-label="Быстрый выбор гарантии"
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              value={
                GUARANTEE_PRESETS.includes(Number(guaranteeDays))
                  ? guaranteeDays
                  : ""
              }
              onChange={(event) => {
                if (event.target.value) setGuaranteeDays(event.target.value)
              }}
            >
              <option value="">Быстрый выбор</option>
              {GUARANTEE_PRESETS.map((days) => (
                <option key={days} value={days}>
                  {days} дн.
                </option>
              ))}
            </select>
          </div>
        </Field>
      </div>
      <Field label="Рекомендации после ремонта">
        <textarea
          value={recommendations}
          onChange={(event) => setRecommendations(event.target.value)}
          rows={2}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none"
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Работы и запчасти</h3>
        <div className="flex flex-wrap gap-2">
          <select
            defaultValue=""
            aria-label="Добавить деталь со склада"
            className="h-8 max-w-64 rounded-lg border border-input bg-transparent px-2 text-sm"
            onChange={(event) => {
              if (event.target.value) attachPart(event.target.value)
              event.target.value = ""
            }}
          >
            <option value="">Добавить со склада</option>
            {parts.map((part) => (
              <option key={part.id} value={part.id}>
                {part.title || "Без названия"} · {part.quantity ?? 0} шт. ·{" "}
                {asText(part.selling_price) || "0"} Р
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => setItems((current) => [...current, emptyItem()])}
          >
            Добавить позицию
          </Button>
        </div>
      </div>
      <div className="grid gap-2">
        {items.map((item, index) => (
          <div key={item.key} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-6">
            <Input
              className="sm:col-span-2"
              placeholder={`${index + 1}. Позиция`}
              value={item.name}
              onChange={(event) => updateItem(item.key, { name: event.target.value })}
            />
            <Input
              placeholder="Артикул"
              value={item.article}
              onChange={(event) => updateItem(item.key, { article: event.target.value })}
            />
            <Input
              type="number"
              placeholder="Гарантия, дн."
              value={item.warranty_days}
              onChange={(event) => updateItem(item.key, { warranty_days: event.target.value })}
            />
            <Input
              type="number"
              placeholder="Цена"
              value={item.price}
              onChange={(event) => updateItem(item.key, { price: event.target.value })}
            />
            <Input
              type="number"
              placeholder="Скидка"
              value={item.discount}
              onChange={(event) => updateItem(item.key, { discount: event.target.value })}
            />
            <Input
              type="number"
              placeholder="Кол-во"
              value={item.quantity}
              onChange={(event) => updateItem(item.key, { quantity: event.target.value })}
            />
            <div className="flex items-center justify-between gap-2 sm:col-span-5">
              <span className="text-sm text-muted-foreground">
                Сумма: {itemSum({
                  price: item.price,
                  discount: item.discount,
                  quantity: item.quantity,
                }).toLocaleString("ru-RU")} Р
              </span>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setItems((current) => current.filter((row) => row.key !== item.key))
                }
              >
                Удалить
              </Button>
            </div>
          </div>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <DialogFooter className="sm:justify-between">
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() => {
            void (async () => {
              if (!window.confirm("Удалить этот заказ? Это действие нельзя отменить.")) return
              setPending(true)
              const { error: deleteError } = await supabase
                .from("orders")
                .delete()
                .eq("id", order.id)
              setPending(false)
              if (deleteError) {
                console.error(deleteError)
                alert(deleteError.message)
                setError(deleteError.message)
                return
              }
              onClose()
              onSaved()
            })()
          }}
        >
          <Trash2 />
          Удалить заказ
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  )
}
