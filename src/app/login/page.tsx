"use client"

import { FormEvent, Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setPending(false)
      setError(
        signInError.message === "Invalid login credentials"
          ? "Неверный email или пароль."
          : signInError.message
      )
      return
    }

    const next = searchParams.get("next")
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/")
    router.refresh()
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-background p-6 shadow-sm"
    >
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-wide">КЁЛТИСОН</h1>
        <p className="text-sm text-muted-foreground">Вход в CRM</p>
      </div>
      <label className="grid gap-1.5 text-sm font-medium">
        Email
        <Input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Пароль
        <Input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Вход…" : "Войти"}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted/60 via-background to-background p-6">
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  )
}
