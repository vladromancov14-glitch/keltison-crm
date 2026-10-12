"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { masterPercentValue, type MasterRow } from "@/lib/masters"
import { supabase } from "@/lib/supabase"

const emptyForm = { name: "", percent: "40" }

function reportError(error: { message: string }) {
  console.error(error)
  alert(error.message)
}

export default function MastersPage() {
  const [masters, setMasters] = useState<MasterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const fetchMasters = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from("masters")
      .select("id, name, default_percent, created_at")
      .order("name", { ascending: true })

    if (loadError) {
      console.error(loadError)
      setError(loadError.message)
      setMasters([])
    } else {
      setError(null)
      setMasters((data ?? []) as MasterRow[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchMasters()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [fetchMasters])

  function startEdit(master: MasterRow) {
    setEditingId(master.id)
    setForm({
      name: master.name,
      percent: String(masterPercentValue(master.default_percent)),
    })
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    const name = form.name.trim()
    const default_percent = masterPercentValue(form.percent)
    if (!name) {
      setError("Укажите имя мастера.")
      return
    }

    setPending(true)
    setError(null)

    const { error: saveError } = editingId
      ? await supabase
          .from("masters")
          .update({ name, default_percent })
          .eq("id", editingId)
      : await supabase.from("masters").insert([{ name, default_percent }])

    setPending(false)
    if (saveError) {
      reportError(saveError)
      setError(saveError.message)
      return
    }

    cancelEdit()
    await fetchMasters()
  }

  async function remove(master: MasterRow) {
    if (!window.confirm(`Удалить мастера «${master.name}»?`)) return
    const { error: deleteError } = await supabase
      .from("masters")
      .delete()
      .eq("id", master.id)
    if (deleteError) {
      reportError(deleteError)
      setError(deleteError.message)
      return
    }
    if (editingId === master.id) cancelEdit()
    await fetchMasters()
  }

  return (
    <section className="flex flex-col gap-4 p-6 print:hidden">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Мастера</h1>
        <p className="text-sm text-muted-foreground">
          Справочник сотрудников. Процент по умолчанию подставляется в заказ и его можно переопределить.
        </p>
      </div>

      <form className="grid max-w-xl gap-3 sm:grid-cols-[1fr_140px_auto]" onSubmit={save}>
        <label className="grid gap-1.5 text-sm font-medium">
          Имя
          <Input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Владислав"
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Процент, %
          <Input
            type="number"
            min="0"
            max="100"
            step="1"
            value={form.percent}
            onChange={(event) =>
              setForm((current) => ({ ...current, percent: event.target.value }))
            }
          />
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={pending}>
            {editingId ? "Сохранить" : "Добавить"}
          </Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={cancelEdit}>
              Отмена
            </Button>
          ) : null}
        </div>
      </form>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Процент по умолчанию</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3}>Загрузка…</TableCell>
              </TableRow>
            ) : masters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>Мастеров пока нет.</TableCell>
              </TableRow>
            ) : (
              masters.map((master) => (
                <TableRow key={master.id}>
                  <TableCell>{master.name}</TableCell>
                  <TableCell>{masterPercentValue(master.default_percent)}%</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEdit(master)}
                        aria-label="Изменить"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(master)}
                        aria-label="Удалить"
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
    </section>
  )
}
