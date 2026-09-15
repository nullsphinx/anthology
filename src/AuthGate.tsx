'use client'

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BookOpen, Check, LoaderCircle, LogIn, Mail, ShieldCheck } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { App } from './App'
import { avatarPresets, defaultAvatarPreset, normalizeAvatarPreset } from './avatars'
import { Avatar } from './components'
import type { Json } from './database.types'
import type { Profile, ProfileShowcases, ProfileVisibility } from './domain'
import { normalizeProfileShowcases } from './profile'
import { getSupabaseBrowserClient, isSupabaseConfigured, sendSupabaseMagicLink } from './lib/supabase/client'

type StoredProfile = {
  user_id: string
  username: string | null
  display_name: string
  avatar_url: string | null
  visibility: ProfileVisibility
  showcase_item_ids: Json
}

function toAppProfile(user: User, profile: StoredProfile): Profile {
  const name = profile.display_name.trim() || profile.username || user.email?.split('@')[0] || 'Reader'
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return { id: user.id, name, handle: profile.username ? `@${profile.username}` : '', initials, color: '#f1a36f', avatar: normalizeAvatarPreset(profile.avatar_url), visibility: profile.visibility, showcaseItemIds: normalizeProfileShowcases(profile.showcase_item_ids) }
}

function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><BookOpen /><strong>Anthology</strong></div>{children}</section></main>
}

function SignedOut() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('auth_error') === 'expired_or_invalid') {
      setMessage('That sign-in link is invalid or has expired. Request a new link and use the newest email.')
      url.searchParams.delete('auth_error')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }, [])

  const sendLink = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await sendSupabaseMagicLink(email.trim(), `${window.location.origin}/auth/callback`)
    const rateLimited = error?.code === 'over_email_send_rate_limit' || error?.message.toLowerCase().includes('rate limit')
    setMessage(error
      ? rateLimited
        ? 'Too many sign-in links were requested. Please wait a few minutes, then request one new link.'
        : error.message.includes('Signups not allowed')
          ? 'This private alpha requires an invitation.'
          : error.message
      : 'Check your email for a secure sign-in link.')
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
  const [avatar, setAvatar] = useState(defaultAvatarPreset)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    const normalized = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (normalized.length < 3) { setMessage('Username must be at least 3 letters, numbers, or underscores.'); setBusy(false); return }
    const profile: StoredProfile = { user_id: user.id, username: normalized, display_name: displayName.trim() || normalized, avatar_url: `preset:${normalizeAvatarPreset(avatar)}`, visibility: 'private', showcase_item_ids: {} }
    const { error } = await getSupabaseBrowserClient()!.from('profiles').upsert(profile)
    if (error) { setMessage(error.code === '23505' ? 'That username is already taken.' : error.message); setBusy(false); return }
    onComplete(profile)
  }

  const preview = { id: user.id, name: displayName || username || 'Your profile', handle: '', initials: '', color: '#f1a36f' }
  return <AuthFrame><span className="auth-kicker">One last step</span><h1>Create your profile.</h1><p>Your library is private by default. You can change visibility later.</p><form onSubmit={save}><label><span>Display name</span><div><input required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></div></label><label><span>Username</span><div><span className="input-prefix">@</span><input required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]+" value={username} onChange={(event) => setUsername(event.target.value)} /></div></label><fieldset className="setup-avatar-field"><legend>Profile picture</legend><div className="avatar-options" role="group" aria-label="Profile picture options">{avatarPresets.map((preset) => <button type="button" key={preset.id} className={avatar === preset.id ? 'selected' : ''} onClick={() => setAvatar(preset.id)} aria-label={preset.label} aria-pressed={avatar === preset.id}><Avatar profile={{ ...preview, avatar: preset.id }} />{avatar === preset.id && <Check />}</button>)}</div></fieldset><button disabled={busy}>{busy ? <LoaderCircle className="spin" /> : null} Create profile</button></form>{message && <div className="auth-message" role="alert">{message}</div>}</AuthFrame>
}

export function AuthGate() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<StoredProfile | null>(null)
  const configured = isSupabaseConfigured()

  const loadProfile = useCallback(async (nextUser: User | null) => {
    setUser(nextUser)
    if (!nextUser) { setProfile(null); setLoading(false); return }
    const { data } = await getSupabaseBrowserClient()!.from('profiles').select('user_id, username, display_name, avatar_url, visibility, showcase_item_ids').eq('user_id', nextUser.id).maybeSingle()
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
  const updateAvatar = async (avatar: string) => {
    const avatarUrl = `preset:${normalizeAvatarPreset(avatar)}`
    const { error } = await getSupabaseBrowserClient()!.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', user.id)
    if (error) throw error
    setProfile((current) => current ? { ...current, avatar_url: avatarUrl } : current)
  }
  const updateProfileSettings = async (changes: { visibility?: ProfileVisibility; showcaseItemIds?: ProfileShowcases }) => {
    const update: { visibility?: ProfileVisibility; showcase_item_ids?: ProfileShowcases } = {}
    if (changes.visibility) update.visibility = changes.visibility
    if (changes.showcaseItemIds) update.showcase_item_ids = normalizeProfileShowcases(changes.showcaseItemIds)
    const { error } = await getSupabaseBrowserClient()!.from('profiles').update(update).eq('user_id', user.id)
    if (error) throw error
    setProfile((current) => current ? { ...current, ...(update.visibility ? { visibility: update.visibility } : {}), ...(update.showcase_item_ids ? { showcase_item_ids: update.showcase_item_ids } : {}) } : current)
  }
  return <App account={toAppProfile(user, profile)} onAvatarChange={updateAvatar} onProfileSettingsChange={updateProfileSettings} onSignOut={() => getSupabaseBrowserClient()!.auth.signOut()} />
}
