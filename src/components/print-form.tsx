import type { ServiceSettings } from "@/lib/service-settings"

export type PrintOrder = {
  order_number: number
  created_at: string | null
  device_type: string | null
  brand_model: string | null
  serial_number: string | null
  appearance: string | null
  declared_defect: string | null
  repair_cost: number | string | null
  client_name: string | null
  client_phone: string | null
}

export function formatPrintDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value))
}

export function formatPrintTime(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatPrintMoney(value: number | string | null) {
  if (value == null || value === "") return ""
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return ""
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function deviceLabel(order: PrintOrder) {
  return [order.device_type, order.brand_model].filter(Boolean).join(", ")
}

export function PrintSheet({ children }: { children: React.ReactNode }) {
  return (
    <article className="mx-auto hidden w-[210mm] min-h-[297mm] bg-white px-[12mm] py-[10mm] text-[11px] leading-snug text-black print:block">
      {children}
    </article>
  )
}

export function PrintHeading({
  title,
  subtitle,
  settings,
}: {
  title: string
  subtitle: string
  settings: ServiceSettings
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-6">
      <div>
        <h1 className="text-[22px] leading-none font-bold">{title}</h1>
        <p className="mt-2 text-[13px] font-semibold">{subtitle}</p>
      </div>
      <div className="text-right text-[11px] leading-tight">
        <div className="font-semibold">
          {settings.name}, {settings.city}
        </div>
        <div>{settings.address}</div>
        <div>{settings.phone}</div>
      </div>
    </header>
  )
}

export function PrintInfo({
  rows,
  qrDataUrl,
}: {
  rows: { label: string; value: string }[]
  qrDataUrl: string | null
}) {
  return (
    <div className="flex items-start gap-4">
      <table className="w-full border-collapse border border-black text-[11px]">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th className="w-[48mm] border border-black px-1.5 py-1 text-left align-top font-semibold">
                {row.label}
              </th>
              <td className="border border-black px-1.5 py-1 align-top whitespace-pre-wrap">
                {row.value || "\u00a0"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="w-[34mm] shrink-0 text-center">
        {qrDataUrl ? (
          // QR is a generated data URL, not a remote image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="QR-код статуса заказа"
            className="mx-auto size-[32mm]"
          />
        ) : (
          <div className="mx-auto size-[32mm] border border-black" />
        )}
        <p className="mt-1 text-[8px] leading-tight">
          Наведите камеру на QR-код, чтобы узнать статус заказа
        </p>
      </div>
    </div>
  )
}

export function PrintSignatures({ clientName }: { clientName: string | null }) {
  return (
    <section className="mt-6 grid grid-cols-2 gap-8">
      <div>
        <p className="text-[12px] font-semibold">Менеджер</p>
        <div className="mt-8 border-b border-black" />
        <p className="mt-1 text-[8px] text-black/70">подпись</p>
      </div>
      <div>
        <p className="text-[12px] font-semibold">Заказчик</p>
        <p className="mt-2 min-h-4 text-[11px]">{clientName || "\u00a0"}</p>
        <div className="mt-4 border-b border-black" />
        <p className="mt-1 text-[8px] leading-tight text-black/70">
          ФИО и подпись. С условиями оказания услуг ознакомлен и согласен
        </p>
      </div>
    </section>
  )
}
