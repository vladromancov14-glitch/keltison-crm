"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ClipboardList,
  LogOut,
  Settings,
  Users,
  Wallet,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"
import { createClient } from "@/lib/supabase/client"

const items: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Заказы", icon: ClipboardList },
  { href: "/clients", label: "Клиенты", icon: Users },
  { href: "/inventory", label: "Склад", icon: Warehouse },
  { href: "/masters", label: "Мастера", icon: Wrench },
  { href: "/finance", label: "Финансы", icon: Wallet },
  { href: "/settings", label: "Настройки", icon: Settings },
]

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavigationFallback() {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5 text-lg font-semibold tracking-wide">
        КЁЛТИСОН
      </div>
      <nav aria-label="Основное меню" className="flex flex-col gap-1 px-3">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <span
              key={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground"
            >
              <Icon />
              {item.label}
            </span>
          )
        })}
      </nav>
    </div>
  )
}

function NavigationInner({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    onNavigate?.()
    router.replace("/login")
    router.refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5 text-lg font-semibold tracking-wide">
        КЁЛТИСОН
      </div>
      <nav aria-label="Основное меню" className="flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              )}
            >
              <Icon />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto border-t border-border p-3">
        <button
          type="button"
          disabled={loggingOut}
          onClick={() => void logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          <LogOut />
          {loggingOut ? "Выход…" : "Выйти"}
        </button>
      </div>
    </div>
  )
}

export function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavigationFallback />}>
      <NavigationInner onNavigate={onNavigate} />
    </Suspense>
  )
}
