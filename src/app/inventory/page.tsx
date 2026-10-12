"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Minus, Plus, Trash2 } from "lucide-react"
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
import { supabase } from "@/lib/supabase"

const CATEGORIES = ["Дисплеи", "АКБ", "Разъемы", "Химия", "Прочее"]

type PartRow = {
  id: string
  title: string | null
  category: string | null
  sku: string | null
  article: string | null
  quantity: number | null
  purchase_price: number | string | null
  selling_price: number | string | null
  created_at: string | null
}

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
})

function formatMoney(value: number | string | null) {
  if (value == null || value === "") return "—"
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return "—"
  return money.format(amount)
}

function articleOf(part: PartRow) {
  return part.sku || part.article || ""
}

export default function InventoryPage() {
  const [parts, setParts] = useState<PartRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("")
  const [open, setOpen] = useState(false)

  const loadParts = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from("parts")
      .select("id, title, category, sku, article, quantity, purchase_price, selling_price, created_at")
      .order("title", { ascending: true })

    if (loadError) {
      setError(
        /parts|schema cache|relation/i.test(loadError.message)
          ? "Выполните обновлённый supabase_schema.sql, чтобы создать таблицу parts."
          : loadError.message
      )
      setParts([])
    } else {
      setError(null)
      setParts((data ?? []) as PartRow[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadParts()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadParts])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return parts.filter((part) => {
      const matchesCategory = !category || part.category === category
      const haystack = `${part.title ?? ""} ${articleOf(part)}`.toLowerCase()
      return matchesCategory && (!needle || haystack.includes(needle))
    })
  }, [category, parts, query])

  async function adjust(part: PartRow, delta: number) {
    const next = Math.max(0, (part.quantity ?? 0) + delta)
    const { error: saveError } = await supabase
      .from("parts")
      .update({ quantity: next })
      .eq("id", part.id)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setParts((current) =>
      current.map((item) => (item.id === part.id ? { ...item, quantity: next } : item))
    )
  }

  async function remove(part: PartRow) {
    if (!window.confirm(`Удалить «${part.title || "позицию"}» со склада?`)) return
    const { error: deleteError } = await supabase.from("parts").delete().eq("id", part.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setParts((current) => current.filter((item) => item.id !== part.id))
  }

  return (
    <section className="flex flex-col gap-4 p-6 print:hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Склад</h1>
          <p className="text-sm text-muted-foreground">
            Запчасти и материалы. Остаток 2 шт. и меньше подсвечивается.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          Добавить деталь
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по названию или артикулу"
          className="max-w-sm"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          aria-label="Категория"
        >
          <option value="">Все категории</option>
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
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
              <TableHead>Название</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Артикул</TableHead>
              <TableHead>Остаток</TableHead>
              <TableHead>Закупка</TableHead>
              <TableHead>Продажа</TableHead>
              <TableHead>Движение</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  Загрузка…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  Позиции не найдены
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((part) => {
                const quantity = part.quantity ?? 0
                const low = quantity <= 2
                return (
                  <TableRow
                    key={part.id}
                    className={
                      quantity <= 0
                        ? "bg-red-50 text-red-950"
                        : low
                          ? "bg-amber-50 text-amber-950"
                          : undefined
                    }
                  >
                    <TableCell>{part.title || "—"}</TableCell>
                    <TableCell>{part.category || "—"}</TableCell>
                    <TableCell>{articleOf(part) || "—"}</TableCell>
                    <TableCell className="font-medium">{quantity}</TableCell>
                    <TableCell>{formatMoney(part.purchase_price)}</TableCell>
                    <TableCell>{formatMoney(part.selling_price)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label="Списать 1"
                          title="Списать"
                          onClick={() => void adjust(part, -1)}
                        >
                          <Minus />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label="Пополнить на 1"
                          title="Пополнить"
                          onClick={() => void adjust(part, 1)}
                        >
                          <Plus />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Удалить ${part.title || "позицию"}`}
                        onClick={() => void remove(part)}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AddPartModal
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          void loadParts()
        }}
      />
    </section>
  )
}

function AddPartModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState("")
  const [article, setArticle] = useState("")
  const [category, setCategory] = useState(CATEGORIES[0])
  const [quantity, setQuantity] = useState("0")
  const [purchasePrice, setPurchasePrice] = useState("")
  const [sellingPrice, setSellingPrice] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const sku = article.trim()
    const { error: insertError } = await supabase.from("parts").insert({
      title: title.trim(),
      category,
      sku,
      article: sku,
      quantity: Number(quantity) || 0,
      purchase_price: purchasePrice.trim() === "" ? null : Number(purchasePrice),
      selling_price: sellingPrice.trim() === "" ? null : Number(sellingPrice),
    })
    setPending(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setTitle("")
    setArticle("")
    setQuantity("0")
    setPurchasePrice("")
    setSellingPrice("")
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="grid gap-3" onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Новая деталь</DialogTitle>
          </DialogHeader>
          <label className="grid gap-1.5 text-sm font-medium">
            Название
            <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Артикул
            <Input value={article} onChange={(event) => setArticle(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Категория
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Количество
            <Input
              type="number"
              min="0"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Закупка
            <Input
              type="number"
              min="0"
              step="0.01"
              value={purchasePrice}
              onChange={(event) => setPurchasePrice(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Продажа
            <Input
              type="number"
              min="0"
              step="0.01"
              value={sellingPrice}
              onChange={(event) => setSellingPrice(event.target.value)}
            />
          </label>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Сохранение…" : "Добавить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
