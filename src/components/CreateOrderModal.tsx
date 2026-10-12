"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { normalizePhone, phoneLookupKey, phonesMatch } from "@/lib/phone"
import { useLockBodyScroll } from "@/lib/use-lock-body-scroll"
import { masterPercentValue, type MasterRow } from "@/lib/masters"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const DEVICE_TYPES = [
  "Телефон",
  "Ноутбук",
  "Планшет",
  "Телевизор",
  "Другое",
] as const

const GUARANTEE_PRESETS = [0, 14, 30, 60, 90, 180]

const emptyForm = {
  fullName: "",
  phone: "",
  deviceType: "",
  brandModel: "",
  serialNumber: "",
  declaredDefect: "",
  appearance: "",
  kit: "",
  estimatedReadyAt: "",
  repairCost: "",
  costPrice: "0",
  prepayment: "0",
  receiverNotes: "",
  guaranteeDays: "30",
  masterId: "",
  masterPercent: "",
}

type ClientOrder = {
  device_type: string | null
  brand_model: string | null
  created_at: string | null
}

type DirectoryClient = {
  id: string
  full_name: string | null
  phone: string | null
  orders: ClientOrder[] | null
}

type SuggestionClient = {
  id: string
  fullName: string
  phone: string
  lastVisit: string | null
  devices: string[]
  sourceIds: string[]
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value))
}

function deviceLabel(order: ClientOrder) {
  return [order.device_type, order.brand_model].filter(Boolean).join(" ").trim()
}

function buildSuggestions(rows: DirectoryClient[]): SuggestionClient[] {
  const groups = new Map<string, DirectoryClient[]>()
  for (const client of rows) {
    const key = phoneLookupKey(client.phone ?? "") || `id:${client.id}`
    const bucket = groups.get(key) ?? []
    bucket.push(client)
    groups.set(key, bucket)
  }

  return [...groups.entries()].map(([key, bucket]) => {
    const orders = bucket
      .flatMap((client) => client.orders ?? [])
      .sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""))
    const named = bucket.find((client) => client.full_name?.trim()) ?? bucket[0]
    const devices = [...new Set(orders.map(deviceLabel).filter(Boolean))].slice(0, 5)
    return {
      id: key,
      fullName: named.full_name?.trim() || "Без имени",
      phone: normalizePhone(named.phone ?? "") ?? named.phone ?? "—",
      lastVisit: orders[0]?.created_at ?? null,
      devices,
      sourceIds: bucket.map((client) => client.id),
    }
  })
}

export function CreateOrderModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState(emptyForm)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [directory, setDirectory] = useState<DirectoryClient[]>([])
  const [nameLocked, setNameLocked] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [masters, setMasters] = useState<MasterRow[]>([])
  const phoneFieldRef = useRef<HTMLDivElement>(null)

  useLockBodyScroll(open)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void supabase
      .from("masters")
      .select("id, name, default_percent, created_at")
      .order("name", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setMasters((data ?? []) as MasterRow[])
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void supabase
      .from("clients")
      .select("id, full_name, phone, orders(device_type, brand_model, created_at)")
      .then(({ data, error: loadError }) => {
        if (cancelled) return
        if (loadError) {
          void supabase
            .from("clients")
            .select("id, full_name, phone")
            .then(({ data: basic }) => {
              if (!cancelled) {
                setDirectory(
                  ((basic ?? []) as DirectoryClient[]).map((client) => ({
                    ...client,
                    orders: [],
                  }))
                )
              }
            })
          return
        }
        setDirectory((data ?? []) as DirectoryClient[])
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setShowSuggestions(false)
      setNameLocked(false)
    }
  }, [open])

  useEffect(() => {
    if (!showSuggestions) return
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const root = phoneFieldRef.current
      if (!root) return
      if (event.target instanceof Node && !root.contains(event.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown)
    }
  }, [showSuggestions])

  const clients = useMemo(() => buildSuggestions(directory), [directory])

  const suggestions = useMemo(() => {
    const key = phoneLookupKey(form.phone)
    if (key.length < 2) return []
    return clients
      .filter((client) => phoneLookupKey(client.phone).includes(key))
      .slice(0, 8)
  }, [clients, form.phone])

  function update(field: keyof typeof emptyForm, value: string) {
    if (field === "fullName") setNameLocked(true)
    if (field !== "phone") setShowSuggestions(false)
    setForm((current) => ({ ...current, [field]: value }))
  }

  function applyClient(client: SuggestionClient) {
    setNameLocked(true)
    setShowSuggestions(false)
    setForm((current) => ({
      ...current,
      phone: client.phone === "—" ? current.phone : client.phone,
      fullName: client.fullName,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setShowSuggestions(false)

    const fullName = form.fullName.trim()
    const phone = normalizePhone(form.phone)
    const deviceType = form.deviceType.trim()
    const brandModel = form.brandModel.trim()
    const declaredDefect = form.declaredDefect.trim()

    if (!phone) {
      setError("Укажите телефон в формате +7 и 10 цифр.")
      return
    }

    if (!fullName || !deviceType || !brandModel || !declaredDefect) {
      setError("Заполните ФИО, телефон, тип устройства, модель и неисправность.")
      return
    }

    const repairCost =
      form.repairCost.trim() === "" ? null : Number(form.repairCost)
    if (repairCost != null && !Number.isFinite(repairCost)) {
      setError("Укажите корректную предварительную стоимость.")
      return
    }

    const prepayment =
      form.prepayment.trim() === "" ? 0 : Number(form.prepayment)
    if (!Number.isFinite(prepayment) || prepayment < 0) {
      setError("Укажите корректную предоплату.")
      return
    }

    const costPrice =
      form.costPrice.trim() === "" ? 0 : Number(form.costPrice)
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      setError("Укажите корректные затраты на запчасти.")
      return
    }

    const guaranteeDays =
      form.guaranteeDays.trim() === "" ? 30 : Number(form.guaranteeDays)
    if (!Number.isFinite(guaranteeDays) || guaranteeDays < 0) {
      setError("Укажите корректный срок гарантии.")
      return
    }

    const masterPercent =
      form.masterPercent.trim() === "" ? null : Number(form.masterPercent)
    if (masterPercent != null && (!Number.isFinite(masterPercent) || masterPercent < 0 || masterPercent > 100)) {
      setError("Процент мастера должен быть от 0 до 100.")
      return
    }

    setPending(true)

    const match = directory.find((client) => phonesMatch(client.phone ?? "", phone))
    let clientId = match?.id ?? null
    let createdNew = false

    if (clientId) {
      if (fullName && fullName !== (match?.full_name ?? "")) {
        await supabase
          .from("clients")
          .update({ full_name: fullName, phone })
          .eq("id", clientId)
      } else {
        await supabase.from("clients").update({ phone }).eq("id", clientId)
      }
    } else {
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .insert({ full_name: fullName, phone })
        .select("id")
        .single()

      if (clientError || !client) {
        setPending(false)
        setError(clientError?.message ?? "Не удалось сохранить клиента.")
        return
      }
      clientId = client.id
      createdNew = true
    }

    const { error: orderError } = await supabase.from("orders").insert({
      client_id: clientId,
      device_type: deviceType,
      brand_model: brandModel,
      serial_number: form.serialNumber.trim() || null,
      declared_defect: declaredDefect,
      appearance: form.appearance.trim() || null,
      kit: form.kit.trim() || null,
      estimated_ready_at: form.estimatedReadyAt || null,
      repair_cost: repairCost,
      cost_price: costPrice,
      prepayment,
      receiver_notes: form.receiverNotes.trim() || null,
      guarantee_days: guaranteeDays,
      master_id: form.masterId || null,
      master_percent: form.masterId ? masterPercent : null,
      status: "received",
    })

    if (orderError) {
      if (createdNew && clientId) {
        await supabase.from("clients").delete().eq("id", clientId)
      }
      setPending(false)
      setError(orderError.message)
      return
    }

    setForm(emptyForm)
    setNameLocked(false)
    setShowSuggestions(false)
    setPending(false)
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog
      open={open}
      modal={false}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setError(null)
          setShowSuggestions(false)
          setNameLocked(false)
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto overscroll-contain sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Новый заказ</DialogTitle>
          <DialogDescription>
            Введите телефон — появятся клиенты с историей визитов. Совпадение идёт по последним 10 цифрам.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <Field label="ФИО клиента">
            <Input
              value={form.fullName}
              onChange={(event) => update("fullName", event.target.value)}
              autoComplete="name"
              required
            />
          </Field>
          <div ref={phoneFieldRef} className="relative z-30 grid gap-1.5 text-sm font-medium">
            <span>Телефон клиента</span>
            <Input
              value={form.phone}
              onChange={(event) => {
                const value = event.target.value
                const key = phoneLookupKey(value)
                setShowSuggestions(key.length >= 2)
                setForm((current) => ({ ...current, phone: value }))
                const exact = clients.find((client) => phonesMatch(client.phone, value))
                if (exact && !nameLocked) {
                  setForm((current) => ({
                    ...current,
                    phone: value,
                    fullName: exact.fullName,
                  }))
                }
              }}
              onFocus={() => {
                if (phoneLookupKey(form.phone).length >= 2 && suggestions.length > 0) {
                  setShowSuggestions(true)
                }
              }}
              type="tel"
              autoComplete="off"
              required
            />
            {showSuggestions && suggestions.length > 0 ? (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
                <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">
                    Найдено: {suggestions.length}
                  </span>
                  <button
                    type="button"
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Закрыть подсказки"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      setShowSuggestions(false)
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <ul className="max-h-64 overflow-y-auto">
                  {suggestions.map((client) => (
                    <li key={client.id} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-muted"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          applyClient(client)
                        }}
                      >
                        <span className="font-medium">{client.fullName}</span>
                        <span className="text-xs text-muted-foreground">{client.phone}</span>
                        <span className="text-xs">
                          Последнее обращение: {formatDate(client.lastVisit)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {client.devices.length > 0
                            ? `Устройства: ${client.devices.join(", ")}`
                            : "Устройств в истории пока нет"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <Field label="Тип устройства">
            <Select
              value={form.deviceType}
              onValueChange={(value) => update("deviceType", value ?? "")}
              items={DEVICE_TYPES.map((item) => ({ label: item, value: item }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent>
                {DEVICE_TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Бренд и модель">
            <Input
              value={form.brandModel}
              onChange={(event) => update("brandModel", event.target.value)}
              required
            />
          </Field>
          <Field label="Серийный номер / IMEI">
            <Input
              value={form.serialNumber}
              onChange={(event) => update("serialNumber", event.target.value)}
            />
          </Field>
          <Field label="Заявленная неисправность">
            <textarea
              value={form.declaredDefect}
              onChange={(event) => update("declaredDefect", event.target.value)}
              required
              rows={3}
              className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            />
          </Field>
          <Field label="Внешний вид">
            <Input
              value={form.appearance}
              onChange={(event) => update("appearance", event.target.value)}
            />
          </Field>
          <Field label="Комплектация">
            <Input
              value={form.kit}
              onChange={(event) => update("kit", event.target.value)}
              placeholder="Ноутбук, зарядка, без АКБ"
            />
          </Field>
          <Field label="Ориентировочная дата готовности">
            <Input
              type="date"
              value={form.estimatedReadyAt}
              onChange={(event) => update("estimatedReadyAt", event.target.value)}
            />
          </Field>
          <Field label="Ориентировочная стоимость">
            <Input
              value={form.repairCost}
              onChange={(event) => update("repairCost", event.target.value)}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
            />
          </Field>
          <Field label="Затраты на запчасти / закупку (₽)">
            <Input
              value={form.costPrice}
              onChange={(event) => update("costPrice", event.target.value)}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
            />
          </Field>
          <Field label="Предоплата, ₽">
            <Input
              value={form.prepayment}
              onChange={(event) => update("prepayment", event.target.value)}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
            />
          </Field>
          <Field label="Срок гарантии (дней)">
            <div className="flex gap-2">
              <Input
                value={form.guaranteeDays}
                onChange={(event) => update("guaranteeDays", event.target.value)}
                type="number"
                min="0"
                step="1"
                list="guarantee-days-presets"
              />
              <datalist id="guarantee-days-presets">
                {GUARANTEE_PRESETS.map((days) => (
                  <option key={days} value={days} />
                ))}
              </datalist>
              <select
                aria-label="Быстрый выбор гарантии"
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                value={GUARANTEE_PRESETS.includes(Number(form.guaranteeDays)) ? form.guaranteeDays : ""}
                onChange={(event) => {
                  if (event.target.value) update("guaranteeDays", event.target.value)
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Мастер">
              <select
                value={form.masterId}
                onChange={(event) => {
                  const masterId = event.target.value
                  const master = masters.find((item) => item.id === masterId)
                  setForm((current) => ({
                    ...current,
                    masterId,
                    masterPercent: master
                      ? String(masterPercentValue(master.default_percent))
                      : "",
                  }))
                }}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Не выбран</option>
                {masters.map((master) => (
                  <option key={master.id} value={master.id}>
                    {master.name} ({masterPercentValue(master.default_percent)}%)
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Процент мастера, %">
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.masterPercent}
                onChange={(event) => update("masterPercent", event.target.value)}
                disabled={!form.masterId}
                placeholder={form.masterId ? "0–100" : "Сначала выберите мастера"}
              />
            </Field>
          </div>
          <Field label="Заметки приёмщика">
            <textarea
              value={form.receiverNotes}
              onChange={(event) => update("receiverNotes", event.target.value)}
              rows={2}
              className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            />
          </Field>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Сохранение…" : "Сохранить заказ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  )
}
