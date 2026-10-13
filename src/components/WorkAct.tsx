"use client"

import { PrintHeading, PrintInfoTable, PrintQrBlock } from "@/components/PrintChrome"
import {
  formatPrintDate,
  formatPrintMoney,
  textOrDash,
} from "@/lib/print-format"
import { itemSum, orderStatusUrl, type OrderItemRow } from "@/lib/orders"
import { linesOf, type ServiceSettings } from "@/lib/service-settings"

export type WorkActData = {
  id: string
  order_number: number
  created_at: string | null
  device_type: string | null
  brand_model: string | null
  serial_number: string | null
  appearance: string | null
  kit?: string | null
  declared_defect: string | null
  repair_cost?: number | string | null
  prepayment?: number | string | null
  recommendations?: string | null
  guarantee_days?: number | string | null
  client_name: string | null
  client_phone: string | null
  items?: OrderItemRow[]
}

function guaranteeDaysOf(order: WorkActData) {
  const value = moneyAmount(order.guarantee_days)
  if (value == null) return 30
  return Math.max(0, Math.round(value))
}

function moneyAmount(value: number | string | null | undefined) {
  if (value == null || value === "") return null
  const amount = typeof value === "number" ? value : Number(value)
  return Number.isFinite(amount) ? amount : null
}

function namedItems(items: OrderItemRow[] | undefined) {
  return (items ?? []).filter((item) => item.name?.trim())
}

function actLines(order: WorkActData): OrderItemRow[] {
  const guarantee = guaranteeDaysOf(order)
  const listed = namedItems(order.items).map((item) => ({
    ...item,
    warranty_days: item.warranty_days ?? guarantee,
  }))
  if (listed.length > 0) return listed

  return [
    {
      line_no: 1,
      name: "",
      article: "",
      warranty_days: null,
      price: null,
      discount: null,
      quantity: null,
    },
  ]
}
function rubCell(value: number | string | null | undefined) {
  if (value == null || value === "") return "—"
  const formatted = formatPrintMoney(value)
  return formatted === "—" ? "—" : formatted
}

export function WorkAct({
  order,
  settings,
}: {
  order: WorkActData
  settings: ServiceSettings
}) {
  const device = [order.device_type, order.brand_model].filter(Boolean).join(", ")
  const client = [textOrDash(order.client_name), textOrDash(order.client_phone)].join(", ")
  const items = actLines(order)
  const linesTotal = items.reduce((sum, item) => sum + itemSum(item), 0)
  const orderCost = moneyAmount(order.repair_cost)
  const total = linesTotal > 0 ? linesTotal : (orderCost ?? 0)
  const warranty = linesOf(settings.warranty)

  return (
    <article
      data-print-document
      className="mx-auto hidden w-[210mm] min-h-[297mm] bg-white px-[10mm] py-[8mm] text-black print:block"
    >
      <PrintHeading
        title="Акт выполненных работ"
        subtitle={`Заказ №${order.order_number} от ${formatPrintDate(order.created_at)}`}
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
                label: "Предоплата",
                value:
                  order.prepayment == null || order.prepayment === ""
                    ? "—"
                    : `${formatPrintMoney(order.prepayment)} Р`,
              },
              {
                label: "Рекомендации после ремонта",
                value: textOrDash(order.recommendations),
              },
            ]}
          />
        </div>
        <PrintQrBlock url={orderStatusUrl(order.id)} />
      </div>

      <table className="mb-3 w-full border-collapse text-[10px]">
        <thead>
          <tr>
            {[
              "№",
              "Позиция",
              "Артикул",
              "Гарантия, дн.",
              "Цена, Р",
              "Скидка, Р",
              "Количество",
              "Сумма, Р",
            ].map((title) => (
              <th
                key={title}
                className="border border-black px-1 py-1 text-center font-semibold"
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id ?? index}>
              <td className="border border-black px-1 py-1 text-center">
                {item.line_no ?? index + 1}
              </td>
              <td className="border border-black px-1 py-1">{textOrDash(item.name)}</td>
              <td className="border border-black px-1 py-1">{textOrDash(item.article)}</td>
              <td className="border border-black px-1 py-1 text-center">
                {item.warranty_days ?? "—"}
              </td>
              <td className="border border-black px-1 py-1 text-right">
                {rubCell(item.price)}
              </td>
              <td className="border border-black px-1 py-1 text-right">
                {rubCell(item.discount)}
              </td>
              <td className="border border-black px-1 py-1 text-center">
                {item.quantity ?? "—"}
              </td>
              <td className="border border-black px-1 py-1 text-right">
                {formatPrintMoney(itemSum(item))}
              </td>
            </tr>
          ))}
          <tr>
            <td
              colSpan={8}
              className="border border-black px-2 py-1.5 text-right text-[12px] font-bold"
            >
              Сумма, Р: {total > 0 ? formatPrintMoney(total) : "—"}
            </td>
          </tr>
        </tbody>
      </table>

      <section className="mb-6">
        <h2 className="mb-1 text-[11px] font-bold">Условия гарантийного обслуживания</h2>
        <ol className="list-decimal space-y-0.5 pl-4 text-[8.5px] leading-snug">
          {warranty.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-8 text-[12px]">
        <p>
          Менеджер: <span className="inline-block w-40 border-b border-black" />
        </p>
        <p>
          Заказчик: <span className="inline-block w-40 border-b border-black" />{" "}
          {textOrDash(order.client_name)}
        </p>
      </section>
    </article>
  )
}
