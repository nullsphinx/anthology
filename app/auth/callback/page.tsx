'use client'

import { BookOpen, LoaderCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { getSupabaseBrowserClient } from '../../../src/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const finishSignIn = async () => {
      const client = getSupabaseBrowserClient()
      const url = new URL(window.location.href)
      const fragment = new URLSearchParams(url.hash.slice(1))
      const accessToken = fragment.get('access_token')
      const refreshToken = fragment.get('refresh_token')
      const code = url.searchParams.get('code')

      let failed = !client
      if (client && accessToken && refreshToken) {
        const { error } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        failed = Boolean(error)
      } else if (client && code) {
        const { error } = await client.auth.exchangeCodeForSession(code)
        failed = Boolean(error)
      } else {
        failed = true
      }

      router.replace(failed ? '/?auth_error=expired_or_invalid' : '/')
    }

    void finishSignIn()
  }, [router])

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><BookOpen /><strong>Anthology</strong></div>
        <div className="auth-loading"><LoaderCircle className="spin" /> Securing your shelf…</div>
      </section>
    </main>
  )
}
