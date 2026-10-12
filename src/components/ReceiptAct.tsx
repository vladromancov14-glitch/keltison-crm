"use client"

import { PrintHeading, PrintInfoTable, PrintQrBlock } from "@/components/PrintChrome"
import { formatPrintDate, formatPrintDateTime, formatPrintMoney, textOrDash } from "@/lib/print-format"
import { orderStatusUrl } from "@/lib/orders"
import { linesOf, type ServiceSettings } from "@/lib/service-settings"

export type ReceiptActData = {
  id: string
  order_number: number
  created_at: string | null
  device_type: string | null
  brand_model: string | null
  serial_number: string | null
  appearance: string | null
  kit?: string | null
  declared_defect: string | null
  repair_cost: number | string | null
  prepayment?: number | string | null
  estimated_ready_at?: string | null
  receiver_notes?: string | null
  client_name: string | null
  client_phone: string | null
}

function rub(value: number | string | null | undefined) {
  if (value == null || value === "") return "—"
  const formatted = formatPrintMoney(value)
  return formatted === "—" ? "—" : `${formatted} Р`
}

export function ReceiptAct({
  order,
  settings,
}: {
  order: ReceiptActData
  settings: ServiceSettings
}) {
  const device = [order.device_type, order.brand_model].filter(Boolean).join(", ")
  const client = [textOrDash(order.client_name), textOrDash(order.client_phone)].join(", ")
  const terms = linesOf(settings.terms)

  return (
    <article
      data-print-document
      className="mx-auto hidden w-[210mm] min-h-[297mm] bg-white px-[10mm] py-[8mm] text-black print:block"
    >
      <PrintHeading
        title="Приемная квитанция"
        subtitle={`Заказ №${order.order_number} от ${formatPrintDateTime(order.created_at)}`}
        settings={settings}
      />

      <div className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <PrintInfoTable
            rows={[
              { label: "Клиент", value: client },
              { label: "Причина обращения", value: textOrDash(order.declared_defect) },
              { label: "Вид устройства", value: textOrDash(device) },
              { label: "Серийный номер / IMEI", value: textOrDash(order.serial_number) },
              { label: "Внешний вид", value: textOrDash(order.appearance) },
              { label: "Комплектация", value: textOrDash(order.kit) },
              {
                label: "Ориентировочная дата готовности",
                value: order.estimated_ready_at
                  ? formatPrintDate(order.estimated_ready_at)
                  : "—",
              },
              { label: "Ориентировочная стоимость", value: rub(order.repair_cost) },
              { label: "Предоплата", value: rub(order.prepayment) },
              { label: "Заметки приемщика", value: textOrDash(order.receiver_notes) },
            ]}
          />
        </div>
        <PrintQrBlock url={orderStatusUrl(order.id)} />
      </div>

      <section className="mb-5">
        <h2 className="mb-1 text-[11px] font-bold">Условия оказания услуг</h2>
        <ol className="list-decimal space-y-0.5 pl-4 text-[8.5px] leading-snug">
          {terms.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section className="mt-6 space-y-3 text-[12px]">
        <p>
          Менеджер: <span className="inline-block w-48 border-b border-black" />
        </p>
        <p>
          Заказчик: <span className="inline-block w-40 border-b border-black" />{" "}
          {textOrDash(order.client_name)} с условиями оказания услуг ознакомлен и
          согласен
        </p>
        <p>Дата: {formatPrintDate(order.created_at)}</p>
      </section>
    </article>
  )
}
