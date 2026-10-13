import { createClient } from "@/lib/supabase/client"

/** Browser Supabase client (session cookies via @supabase/ssr). */
export const supabase = createClient()
