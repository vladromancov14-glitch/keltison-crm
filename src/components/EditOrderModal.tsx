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

function emptyService(): DraftItem {
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

function draftSum(item: DraftItem) {
  return itemSum({
    price: item.price,
    discount: item.discount,
    quantity: item.quantity,
  })
}

function toDrafts(items: OrderItemRow[] | null): DraftItem[] {
  if (!items?.length) return [emptyService()]
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

  const services = items.filter((item) => !item.partId)
  const stockLines = items.filter((item) => item.partId)
  const servicesTotal = services
    .filter((item) => item.name.trim())
    .reduce((sum, item) => sum + draftSum(item), 0)
  const partsTotal = stockLines
    .filter((item) => item.name.trim())
    .reduce((sum, item) => sum + draftSum(item), 0)
  const linesTotal = servicesTotal + partsTotal
  const hasNamedLines = items.some((item) => item.name.trim())
  const effectiveRepairCost = hasNamedLines
    ? linesTotal
    : repairCost.trim() === ""
      ? null
      : Number(repairCost)

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
    setItems((current) => [...current, line])
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

    const incomplete = services.find(
      (item) =>
        !item.name.trim() &&
        (item.price.trim() !== "" ||
          (item.quantity.trim() !== "" && item.quantity.trim() !== "1"))
    )
    if (incomplete) {
      setPending(false)
      setError("Укажите название услуги для каждой заполненной строки.")
      return
    }

    const rows = items
      .filter((item) => item.name.trim())
      .map((item, index) => ({
        order_id: order.id,
        part_id: item.partId,
        line_no: index + 1,
        name: item.name.trim(),
        article: item.partId ? item.article.trim() || null : null,
        warranty_days: item.partId
          ? item.warranty_days.trim() === ""
            ? Number(guaranteeDays) || 30
            : Number(item.warranty_days)
          : Number(guaranteeDays) || 30,
        price: item.price.trim() === "" ? null : Number(item.price),
        discount: item.partId
          ? item.discount.trim() === ""
            ? 0
            : Number(item.discount)
          : 0,
        quantity: item.quantity.trim() === "" ? 1 : Number(item.quantity),
      }))

    const savedRepairCost =
      rows.length > 0
        ? rows.reduce(
            (sum, row) =>
              sum +
              itemSum({
                price: row.price,
                discount: row.discount,
                quantity: row.quantity,
              }),
            0
          )
        : repairCost.trim() === ""
          ? null
          : Number(repairCost)

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
        repair_cost: savedRepairCost,
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
        <Field
          label={
            hasNamedLines
              ? "Стоимость ремонта (сумма услуг и запчастей)"
              : "Ориентировочная стоимость"
          }
        >
          <Input
            type="number"
            min="0"
            step="0.01"
            value={
              hasNamedLines
                ? String(linesTotal)
                : repairCost
            }
            readOnly={hasNamedLines}
            onChange={(event) => {
              if (!hasNamedLines) setRepairCost(event.target.value)
            }}
            className={hasNamedLines ? "bg-muted" : undefined}
          />
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

      <section className="grid gap-2 rounded-xl border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Услуги</h3>
          <Button
            type="button"
            variant="outline"
            onClick={() => setItems((current) => [...current, emptyService()])}
          >
            Добавить услугу
          </Button>
        </div>
        <div className="hidden grid-cols-[minmax(0,1fr)_7rem_5rem_7rem_auto] gap-2 text-xs text-muted-foreground sm:grid">
          <span>Услуга</span>
          <span>Цена, ₽</span>
          <span>Кол-во</span>
          <span>Сумма</span>
          <span />
        </div>
        <div className="grid gap-2">
          {services.map((item, index) => (
            <div
              key={item.key}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_5rem_7rem_auto] sm:items-center"
            >
              <Input
                placeholder={`${index + 1}. Например: замена экрана`}
                value={item.name}
                onChange={(event) =>
                  updateItem(item.key, { name: event.target.value })
                }
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Цена"
                value={item.price}
                onChange={(event) =>
                  updateItem(item.key, { price: event.target.value })
                }
              />
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="Кол-во"
                value={item.quantity}
                onChange={(event) =>
                  updateItem(item.key, { quantity: event.target.value })
                }
              />
              <div className="flex h-8 items-center text-sm tabular-nums">
                {draftSum(item).toLocaleString("ru-RU")} ₽
              </div>
              <Button
                type="button"
                variant="ghost"
                className="justify-self-start"
                onClick={() =>
                  setItems((current) => {
                    const next = current.filter((row) => row.key !== item.key)
                    return next.some((row) => !row.partId) ? next : [...next, emptyService()]
                  })
                }
              >
                Удалить
              </Button>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-sm font-medium">
          <span>Сумма услуг</span>
          <span className="tabular-nums">
            {servicesTotal.toLocaleString("ru-RU")} ₽
          </span>
        </div>
      </section>

      <section className="grid gap-2 rounded-xl border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Запчасти со склада</h3>
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
                {asText(part.selling_price) || "0"} ₽
              </option>
            ))}
          </select>
        </div>
        {stockLines.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Пока без запчастей — только услуги выше.
          </p>
        ) : (
          <div className="grid gap-2">
            {stockLines.map((item) => (
              <div
                key={item.key}
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_5rem_7rem_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{item.name}</div>
                  {item.article ? (
                    <div className="text-xs text-muted-foreground">
                      Арт. {item.article}
                    </div>
                  ) : null}
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Цена"
                  value={item.price}
                  onChange={(event) =>
                    updateItem(item.key, { price: event.target.value })
                  }
                />
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Кол-во"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(item.key, { quantity: event.target.value })
                  }
                />
                <div className="flex h-8 items-center text-sm tabular-nums">
                  {draftSum(item).toLocaleString("ru-RU")} ₽
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-self-start"
                  onClick={() =>
                    setItems((current) =>
                      current.filter((row) => row.key !== item.key)
                    )
                  }
                >
                  Удалить
                </Button>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-2 text-sm font-medium">
              <span>Сумма запчастей</span>
              <span className="tabular-nums">
                {partsTotal.toLocaleString("ru-RU")} ₽
              </span>
            </div>
          </div>
        )}
      </section>

      {hasNamedLines ? (
        <p className="text-sm font-semibold tabular-nums">
          Итого к стоимости ремонта:{" "}
          {(effectiveRepairCost ?? 0).toLocaleString("ru-RU")} ₽
        </p>
      ) : null}
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
