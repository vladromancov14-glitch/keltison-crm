"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"

export function PrintQrCode({
  value,
  size = 96,
}: {
  value: string
  size?: number
}) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [size, value])

  if (!src) {
    return (
      <div
        className="border border-black/30 bg-white"
        style={{ width: size, height: size }}
        aria-hidden
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="QR-код статуса заказа"
      width={size}
      height={size}
      className="border border-black/20 bg-white"
    />
  )
}
