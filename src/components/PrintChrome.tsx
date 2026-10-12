"use client"

import { QRCodeSVG } from "qrcode.react"
import type { ServiceSettings } from "@/lib/service-settings"
import { headerLine } from "@/lib/service-settings"

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
    <header className="mb-3 grid grid-cols-[1fr_220px] items-start gap-4 border-b-2 border-black pb-2">
      <div>
        <h1 className="text-[26px] leading-none font-bold tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-[13px] font-semibold">{subtitle}</p>
      </div>
      <p className="text-right text-[11px] leading-snug font-medium">
        {headerLine(settings)}
      </p>
    </header>
  )
}

export function PrintQrBlock({ url }: { url: string }) {
  return (
    <aside className="flex w-[42mm] shrink-0 flex-col items-center border-2 border-black p-2 text-center">
      <p className="mb-2 text-[9px] leading-tight font-medium">
        Наведите камеру на QR-код, чтобы узнать статус заказа
      </p>
      <QRCodeSVG
        value={url}
        size={108}
        level="M"
        bgColor="#ffffff"
        fgColor="#000000"
        aria-label="QR-код статуса заказа"
      />
      <p className="mt-2 text-[8px] leading-tight break-all">{url}</p>
    </aside>
  )
}

export function PrintInfoTable({
  rows,
}: {
  rows: { label: string; value: string }[]
}) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="align-top">
            <th className="w-[38%] border border-black px-1.5 py-1 text-left font-semibold">
              {row.label}
            </th>
            <td className="border border-black px-1.5 py-1 whitespace-pre-wrap">
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
