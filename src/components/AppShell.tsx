"use client"

import { useState } from "react"
import { Menu } from "lucide-react"

import { Navigation } from "@/components/Navigation"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="hidden w-[240px] shrink-0 border-r border-border bg-background print:hidden md:flex md:flex-col">
        <Navigation />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-border px-3 print:hidden md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Открыть меню"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[240px] max-w-[240px] data-[side=left]:w-[240px] sm:max-w-[240px]"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Меню</SheetTitle>
              </SheetHeader>
              <Navigation onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="text-lg font-semibold tracking-wide">КЁЛТИСОН</span>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
