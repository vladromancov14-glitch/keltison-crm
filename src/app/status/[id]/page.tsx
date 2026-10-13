"use client"

import { use, useEffect, useState, Suspense } from "react"
import { statusLabel } from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"

type StatusOrder = {
  order_number: number
  status: string
  device_type: string | null
  brand_model: string | null
  created_at: string | null
  estimated_ready_at: string | null
}

async function loadPublicStatus(id: string): Promise<{
  order: StatusOrder | null
  error: string | null
}> {
  const supabase = createClient()

  const rpc = await supabase.rpc("get_order_public_status", { p_id: id })
  if (!rpc.error) {
    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data
    return { order: (row as StatusOrder | null) ?? null, error: null }
  }

  // Fallback until SQL function is applied in Supabase.
  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_number, status, device_type, brand_model, created_at, estimated_ready_at"
    )
    .eq("id", id)
    .maybeSingle()

  if (error) return { order: null, error: error.message }
  return { order: data as StatusOrder | null, error: null }
}

function OrderStatusContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<StatusOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void loadPublicStatus(id).then((result) => {
      if (cancelled) return
      setOrder(result.order)
      setError(result.error)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const device = [order?.device_type, order?.brand_model].filter(Boolean).join(" ")

  return (
    <section className="mx-auto flex min-h-full max-w-lg flex-col gap-4 p-6">
      <div>
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          КЁЛТИСОН
        </p>
        <h1 className="text-2xl font-semibold">Статус заказа</h1>
      </div>
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
        <dl className="grid gap-3 rounded-2xl border border-border p-4 text-sm">
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
                ? new Intl.DateTimeFormat("ru-RU").format(
                    new Date(order.estimated_ready_at)
                  )
                : "—"}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  )
}

export default function OrderStatusPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Загрузка страницы статуса...
        </div>
      }
    >
      <OrderStatusContent params={params} />
    </Suspense>
  )
}
