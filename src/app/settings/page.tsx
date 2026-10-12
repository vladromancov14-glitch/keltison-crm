"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  defaultServiceSettings,
  readServiceSettings,
  writeServiceSettings,
  type ServiceSettings,
} from "@/lib/service-settings"

export default function SettingsPage() {
  const [form, setForm] = useState<ServiceSettings>(defaultServiceSettings)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setForm(readServiceSettings())
  }, [])

  function update(field: keyof ServiceSettings, value: string) {
    setSaved(false)
    setForm((current) => ({ ...current, [field]: value }))
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    writeServiceSettings(form)
    setSaved(true)
  }

  return (
    <section className="flex flex-col gap-4 p-6 print:hidden">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="text-sm text-muted-foreground">
          Реквизиты и тексты подставляются в приемную квитанцию и акт выполненных работ.
        </p>
      </div>

      <form className="grid max-w-3xl gap-4" onSubmit={save}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Название сервиса">
            <Input value={form.name} onChange={(event) => update("name", event.target.value)} />
          </Field>
          <Field label="Город">
            <Input value={form.city} onChange={(event) => update("city", event.target.value)} />
          </Field>
          <Field label="Адрес">
            <Input value={form.address} onChange={(event) => update("address", event.target.value)} />
          </Field>
          <Field label="Телефон">
            <Input value={form.phone} onChange={(event) => update("phone", event.target.value)} />
          </Field>
        </div>
        <Field label="Условия оказания услуг (каждый пункт с новой строки)">
          <textarea
            value={form.terms}
            onChange={(event) => update("terms", event.target.value)}
            rows={10}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none"
          />
        </Field>
        <Field label="Условия гарантийного обслуживания (каждый пункт с новой строки)">
          <textarea
            value={form.warranty}
            onChange={(event) => update("warranty", event.target.value)}
            rows={8}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none"
          />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit">Сохранить</Button>
          {saved ? <p className="text-sm text-muted-foreground">Сохранено в этом браузере</p> : null}
        </div>
      </form>
    </section>
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
