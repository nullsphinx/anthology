import { createBrowserClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../database.types'

let browserClient: SupabaseClient<Database> | undefined

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
}

export function getLocalAuthInboxUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  const host = new URL(url).hostname
  return ['localhost', '127.0.0.1', '[::1]'].includes(host) ? 'http://127.0.0.1:54324' : null
}

export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null
  browserClient ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { detectSessionInUrl: false } },
  )
  return browserClient
}

export async function sendSupabaseMagicLink(email: string, redirectTo: string, requestInvite = false) {
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'implicit',
        persistSession: false,
      },
      global: {
        fetch: (input, init) => fetch(input, {
          ...init,
          signal: init?.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)])
            : AbortSignal.timeout(15_000),
        }),
      },
    },
  )

  const normalizedEmail = email.trim().toLowerCase()
  if (requestInvite) {
    const { error } = await client.rpc('request_invite', { p_email: normalizedEmail })
    if (error) return { error }
  }

  return client.auth.signInWithOtp({
    email: normalizedEmail,
    // Account creation is still invite-only: the Before User Created hook
    // rejects any email without an active row in public.invites.
    options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
  })
}
