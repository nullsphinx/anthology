'use client'

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BookOpen, LoaderCircle, LogIn, Mail, ShieldCheck } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { App } from './App'
import type { Profile } from './domain'
import { getSupabaseBrowserClient, isSupabaseConfigured } from './lib/supabase/client'

type StoredProfile = {
  user_id: string
  username: string | null
  display_name: string
}

function toAppProfile(user: User, profile: StoredProfile): Profile {
  const name = profile.display_name.trim() || profile.username || user.email?.split('@')[0] || 'Reader'
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return { id: user.id, name, handle: profile.username ? `@${profile.username}` : '', initials, color: '#f1a36f' }
}

function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><BookOpen /><strong>Anthology</strong></div>{children}</section></main>
}

function SignedOut() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'

  const sendLink = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    const client = getSupabaseBrowserClient()!
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setMessage(error ? (error.message.includes('Signups not allowed') ? 'This private alpha requires an invitation.' : error.message) : 'Check your email for a secure sign-in link.')
    setBusy(false)
  }

  const signInWithGoogle = async () => {
    setBusy(true); setMessage('')
    const { error } = await getSupabaseBrowserClient()!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })
    if (error) { setMessage(error.message); setBusy(false) }
  }

  return <AuthFrame><span className="auth-kicker"><ShieldCheck /> Private alpha</span><h1>Your stories, all in one place.</h1><p>Sign in with an invited email to build a private, persistent shelf across movies, television, books, and albums.</p><form onSubmit={sendLink}><label><span>Email address</span><div><Mail /><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div></label><button disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <LogIn />} Email me a sign-in link</button></form>{googleEnabled && <button className="oauth-button" onClick={signInWithGoogle} disabled={busy}>Continue with Google</button>}{message && <div className="auth-message" role="status">{message}</div>}<small>Anthology is invite-only while the foundation is being tested.</small></AuthFrame>
}

function ProfileSetup({ user, onComplete }: { user: User; onComplete: (profile: StoredProfile) => void }) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState(user.user_metadata.full_name ?? '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    const normalized = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (normalized.length < 3) { setMessage('Username must be at least 3 letters, numbers, or underscores.'); setBusy(false); return }
    const profile = { user_id: user.id, username: normalized, display_name: displayName.trim() || normalized }
    const { error } = await getSupabaseBrowserClient()!.from('profiles').upsert(profile)
    if (error) { setMessage(error.code === '23505' ? 'That username is already taken.' : error.message); setBusy(false); return }
    onComplete(profile)
  }

  return <AuthFrame><span className="auth-kicker">One last step</span><h1>Create your profile.</h1><p>Your library is private by default. You can change visibility later.</p><form onSubmit={save}><label><span>Display name</span><div><input required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></div></label><label><span>Username</span><div><span className="input-prefix">@</span><input required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]+" value={username} onChange={(event) => setUsername(event.target.value)} /></div></label><button disabled={busy}>{busy ? <LoaderCircle className="spin" /> : null} Create profile</button></form>{message && <div className="auth-message" role="alert">{message}</div>}</AuthFrame>
}

export function AuthGate() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<StoredProfile | null>(null)
  const configured = isSupabaseConfigured()

  const loadProfile = useCallback(async (nextUser: User | null) => {
    setUser(nextUser)
    if (!nextUser) { setProfile(null); setLoading(false); return }
    const { data } = await getSupabaseBrowserClient()!.from('profiles').select('user_id, username, display_name').eq('user_id', nextUser.id).maybeSingle()
    setProfile(data); setLoading(false)
  }, [])

  useEffect(() => {
    if (!configured) { setLoading(false); return }
    const client = getSupabaseBrowserClient()!
    client.auth.getUser().then(({ data }) => loadProfile(data.user))
    const { data } = client.auth.onAuthStateChange((_event, session) => { void loadProfile(session?.user ?? null) })
    return () => data.subscription.unsubscribe()
  }, [configured, loadProfile])

  if (!configured) return <App />
  if (loading) return <AuthFrame><div className="auth-loading"><LoaderCircle className="spin" /> Loading your shelf…</div></AuthFrame>
  if (!user) return <SignedOut />
  if (!profile?.username) return <ProfileSetup user={user} onComplete={setProfile} />
  return <App account={toAppProfile(user, profile)} onSignOut={() => getSupabaseBrowserClient()!.auth.signOut()} />
}
