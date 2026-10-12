"use client"

import { useEffect } from "react"

/** Blocks page scroll while a modal is open so only the dialog content scrolls. */
export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    html.style.overflow = "hidden"
    body.style.overflow = "hidden"

    return () => {
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
    }
  }, [locked])
}
