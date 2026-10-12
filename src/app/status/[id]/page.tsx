"use client"

import { use, useEffect, useState } from "react"
import { statusLabel } from "@/lib/orders"
import { supabase } from "@/lib/supabase"

type StatusOrder = {
  order_number: number
  status: string
  device_type: string | null
  brand_model: string | null
  created_at: string | null
  estimated_ready_at: string | null
}

export default function OrderStatusPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [order, setOrder] = useState<StatusOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void supabase
      .from("orders")
      .select("order_number, status, device_type, brand_model, created_at, estimated_ready_at")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (cancelled) return
        if (loadError) setError(loadError.message)
        else setOrder(data as StatusOrder | null)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const device = [order?.device_type, order?.brand_model].filter(Boolean).join(" ")

  return (
    <section className="mx-auto flex max-w-lg flex-col gap-3 p-6">
      <h1 className="text-2xl font-semibold">Статус заказа</h1>
      {loading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && !order ? (
        <p className="text-sm text-muted-foreground">Заказ не найден.</p>
      ) : null}
      {order ? (
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Номер</dt>
            <dd className="text-lg font-semibold">{order.order_number}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Статус</dt>
            <dd className="font-medium">{statusLabel(order.status)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Устройство</dt>
            <dd>{device || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ориентировочная дата готовности</dt>
            <dd>
              {order.estimated_ready_at
                ? new Intl.DateTimeFormat("ru-RU").format(new Date(order.estimated_ready_at))
                : "—"}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  )
}
