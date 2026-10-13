import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/status/")
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return supabaseResponse
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
        Object.entries(headers).forEach(([headerName, value]) => {
          supabaseResponse.headers.set(headerName, value)
        })
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const loggedIn = Boolean(data?.claims)

  const { pathname } = request.nextUrl

  if (!loggedIn && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (loggedIn && pathname === "/login") {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/"
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
