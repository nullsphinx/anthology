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
import { getLocalAuthInboxUrl, getSupabaseBrowserClient, isSupabaseConfigured, sendSupabaseMagicLink } from './lib/supabase/client'

type StoredProfile = {
  user_id: string
  username: string | null
  display_name: string
  avatar_url: string | null
  visibility: ProfileVisibility
  showcase_item_ids: Json
  next_up_item_ids: Json
}

function toAppProfile(user: User, profile: StoredProfile): Profile {
  const name = profile.display_name.trim() || profile.username || user.email?.split('@')[0] || 'Reader'
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return { id: user.id, name, handle: profile.username ? `@${profile.username}` : '', initials, color: '#f1a36f', avatar: normalizeAvatarPreset(profile.avatar_url), visibility: profile.visibility, showcaseItemIds: normalizeProfileShowcases(profile.showcase_item_ids), nextUpItemIds: normalizeProfileShowcases(profile.next_up_item_ids) }
}

function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><BookOpen /><strong>Anthology</strong></div>{children}</section></main>
}

function SignedOut() {
  const [email, setEmail] = useState('')
  const [requestInvite, setRequestInvite] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const localInbox = getLocalAuthInboxUrl()
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
    event.preventDefault(); setBusy(true); setMessage(''); setSentTo('')
    try {
      const { error } = await sendSupabaseMagicLink(email, `${window.location.origin}/auth/callback`, requestInvite)
      const rateLimited = error?.code === 'over_email_send_rate_limit' || error?.message.toLowerCase().includes('rate limit')
      if (!error) setSentTo(email.trim().toLowerCase())
      setMessage(error
        ? rateLimited
          ? 'Too many email links were requested. Please wait a few minutes, then try again.'
          : error.message.includes('invitation') || error.message.includes('Signups not allowed')
            ? 'New to Anthology? Choose “Sign up” above to get started.'
            : 'We couldn’t send your email link. Please try again in a moment.'
        : localInbox
          ? 'Your link is in the local test inbox. It will not arrive in your real mailbox.'
          : requestInvite
          ? 'Check your email for your invite link. Follow it to verify your email and create your profile. Already have an account? The link will sign you in.'
          : 'Check your email for a secure sign-in link.')
    } catch {
      setMessage('We couldn’t connect. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const signInWithGoogle = async () => {
    setBusy(true); setMessage('')
    const { error } = await getSupabaseBrowserClient()!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })
    if (error) { setMessage(error.message); setBusy(false) }
  }

  return <AuthFrame>
    <span className="auth-kicker"><ShieldCheck /> Early access</span>
    <div className="auth-modes" role="group" aria-label="Account access">
      <button type="button" aria-pressed={!requestInvite} disabled={busy} onClick={() => { if (requestInvite) { setRequestInvite(false); setMessage(''); setSentTo('') } }}>Sign in</button>
      <button type="button" aria-pressed={requestInvite} disabled={busy} onClick={() => { if (!requestInvite) { setRequestInvite(true); setMessage(''); setSentTo('') } }}>Sign up</button>
    </div>
    <h1>{requestInvite ? 'Sign up for Anthology.' : 'Sign in to Anthology.'}</h1>
    <p>{requestInvite ? 'Request an invite and we’ll email you a secure link to join Anthology and create your profile.' : 'Sign in to build your shelf across movies, television, books, and albums.'}</p>
    {localInbox && <aside className="auth-local-note"><strong>Local email testing</strong><p>Emails go to the test inbox, not your real mailbox. Local accounts are separate from live Anthology; choose Sign up to create one.</p><a href={localInbox} target="_blank" rel="noreferrer">Open local email inbox</a></aside>}
    <form onSubmit={sendLink} aria-busy={busy}>
      <label><span>Email address</span><div><Mail /><input type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={busy} /></div></label>
      <button disabled={busy}>{busy ? <LoaderCircle className="spin" /> : requestInvite ? <Mail /> : <LogIn />}{busy ? 'Sending email…' : requestInvite ? 'Email me an invite link' : 'Email me a sign-in link'}</button>
    </form>
    {googleEnabled && !requestInvite && <button className="oauth-button" onClick={signInWithGoogle} disabled={busy}>Continue with Google</button>}
    {(busy || message) && <div className={`auth-message auth-delivery ${sentTo ? 'auth-delivery-success' : ''}`} role="status" aria-live="polite" aria-atomic="true">
      <strong>{busy ? 'Sending your email link…' : sentTo ? localInbox ? 'Email delivered to the test inbox' : 'Email link sent' : 'Email link not sent'}</strong>
      {sentTo && <span>For {sentTo}</span>}
      {!busy && <p>{message}</p>}
      {sentTo && localInbox && <a href={localInbox} target="_blank" rel="noreferrer">Open your email in the local inbox</a>}
    </div>}
    <small>{requestInvite ? 'No password needed. Your profile and library are private by default.' : 'Use the newest email link. Choose Sign up to request an invite and join.'}</small>
  </AuthFrame>
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
    const profile: StoredProfile = { user_id: user.id, username: normalized, display_name: displayName.trim() || normalized, avatar_url: `preset:${normalizeAvatarPreset(avatar)}`, visibility: 'private', showcase_item_ids: {}, next_up_item_ids: {} }
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
    const { data } = await getSupabaseBrowserClient()!.from('profiles').select('user_id, username, display_name, avatar_url, visibility, showcase_item_ids, next_up_item_ids').eq('user_id', nextUser.id).maybeSingle()
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
  const updateProfileSettings = async (changes: { visibility?: ProfileVisibility; showcaseItemIds?: ProfileShowcases; nextUpItemIds?: ProfileShowcases }) => {
    const update: { visibility?: ProfileVisibility; showcase_item_ids?: ProfileShowcases; next_up_item_ids?: ProfileShowcases } = {}
    if (changes.visibility) update.visibility = changes.visibility
    if (changes.showcaseItemIds) update.showcase_item_ids = normalizeProfileShowcases(changes.showcaseItemIds)
    if (changes.nextUpItemIds) update.next_up_item_ids = normalizeProfileShowcases(changes.nextUpItemIds)
    const { error } = await getSupabaseBrowserClient()!.from('profiles').update(update).eq('user_id', user.id)
    if (error) throw error
    setProfile((current) => current ? { ...current, ...(update.visibility ? { visibility: update.visibility } : {}), ...(update.showcase_item_ids ? { showcase_item_ids: update.showcase_item_ids } : {}), ...(update.next_up_item_ids ? { next_up_item_ids: update.next_up_item_ids } : {}) } : current)
  }
  return <App account={toAppProfile(user, profile)} onAvatarChange={updateAvatar} onProfileSettingsChange={updateProfileSettings} onSignOut={() => getSupabaseBrowserClient()!.auth.signOut()} />
}
