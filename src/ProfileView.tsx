'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, Flag, Globe2, Lock, RotateCcw, Share2, SquarePen, Star, X } from 'lucide-react'
import { Avatar, MediaTypeIcon, Poster } from './components'
import { mediaTypeLabels, type LibraryEntry, type MediaItem, type MediaType, type Profile, type ProfileShowcases, type ProfileVisibility } from './domain'
import { buildProfileShelf, PROFILE_SHOWCASE_LIMIT } from './profile'

const mediaTypes: MediaType[] = ['movie', 'show', 'book', 'album']
const shelfNames: Record<MediaType, string> = { movie: 'Movies', show: 'Television', book: 'Books', album: 'Albums' }
const completedLabels: Record<MediaType, string> = { movie: 'watched', show: 'watched', book: 'read', album: 'listened' }
const queueLabels: Record<MediaType, string> = { movie: 'watchlist', show: 'watchlist', book: 'to be read', album: 'listen later' }

type ShelfMode = 'favorites' | 'priority'

type ProfileViewProps = {
  profile: Profile
  items: MediaItem[]
  entries: LibraryEntry[]
  editable?: boolean
  onOpen?: (item: MediaItem) => void
  onVisibilityChange?: (visibility: ProfileVisibility) => Promise<void>
  onShowcasesChange?: (showcases: ProfileShowcases) => Promise<void>
}

function CoverStrip({ items, label, onOpen }: { items: MediaItem[]; label: string; onOpen?: (item: MediaItem) => void }) {
  return <div className="profile-cover-strip" aria-label={label}>
    {Array.from({ length: PROFILE_SHOWCASE_LIMIT }, (_, index) => {
      const item = items[index]
      if (!item) return <div className="profile-cover-slot empty" key={`empty-${index}`} aria-hidden="true"><span>{index + 1}</span></div>
      return <button type="button" className="profile-cover-slot" key={item.id} onClick={() => onOpen?.(item)} disabled={!onOpen} aria-label={`Open ${item.title}`} title={item.title}><Poster item={item} /></button>
    })}
  </div>
}

function ShowcaseEditor({ shelf, initial, onCancel, onSave }: { shelf: ReturnType<typeof buildProfileShelf>; initial: string[]; onCancel: () => void; onSave: (ids: string[]) => Promise<void> }) {
  const [selected, setSelected] = useState(initial)
  const [saving, setSaving] = useState(false)
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((candidate) => candidate !== id) : current.length < PROFILE_SHOWCASE_LIMIT ? [...current, id] : current)
  const save = async () => { setSaving(true); try { await onSave(selected); onCancel() } finally { setSaving(false) } }

  return <div className="showcase-editor">
    <div className="showcase-editor-heading"><div><strong>Choose up to twelve favorites</strong><span>{selected.length} of {PROFILE_SHOWCASE_LIMIT} selected</span></div><button type="button" onClick={onCancel} aria-label="Close favorite picker"><X /></button></div>
    {shelf.favoriteCandidates.length ? <div className="showcase-candidates">{shelf.favoriteCandidates.map((item) => {
      const active = selected.includes(item.id)
      const disabled = !active && selected.length >= PROFILE_SHOWCASE_LIMIT
      return <button type="button" key={item.id} className={active ? 'selected' : ''} disabled={disabled} onClick={() => toggle(item.id)} aria-pressed={active}><Poster item={item} /><span>{item.title}</span>{active && <Check />}</button>
    })}</div> : <p className="showcase-empty">Mark completed titles as favorites to feature them here.</p>}
    <div className="showcase-editor-actions"><button type="button" className="showcase-reset" onClick={() => setSelected([])}><RotateCcw /> Clear selection</button><button type="button" className="showcase-save" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save display'}</button></div>
  </div>
}

export function ProfileView({ profile, items, entries, editable = false, onOpen, onVisibilityChange, onShowcasesChange }: ProfileViewProps) {
  const [modes, setModes] = useState<Record<MediaType, ShelfMode>>({ movie: 'favorites', show: 'favorites', book: 'favorites', album: 'favorites' })
  const [editing, setEditing] = useState<MediaType | null>(null)
  const [privacyBusy, setPrivacyBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const showcases = profile.showcaseItemIds ?? {}
  const shelves = useMemo(() => mediaTypes.map((type) => buildProfileShelf(type, items, entries, profile.id, showcases)), [entries, items, profile.id, showcases])
  const visibility = profile.visibility ?? 'private'

  const changeVisibility = async () => {
    if (!onVisibilityChange) return
    const next: ProfileVisibility = visibility === 'public' ? 'private' : 'public'
    setPrivacyBusy(true); setNotice('')
    try { await onVisibilityChange(next); setNotice(next === 'public' ? 'Profile is public and ready to share.' : 'Profile is private.') }
    catch { setNotice('Privacy could not be updated. Try again.') }
    finally { setPrivacyBusy(false) }
  }

  const share = async () => {
    if (visibility !== 'public') { setNotice('Make your profile public before sharing it.'); return }
    const username = profile.handle.replace(/^@/, '')
    const url = `${window.location.origin}/profile/${encodeURIComponent(username)}`
    try {
      if (navigator.share) await navigator.share({ title: `${profile.name} on Anthology`, url })
      else { await navigator.clipboard.writeText(url); setNotice('Profile link copied.') }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setNotice('The profile link could not be shared.')
    }
  }

  return <div className="profile-page">
    <section className="profile-hero">
      <div className="profile-identity"><Avatar profile={profile} /><div><span className="eyebrow">My profile</span><h1>{profile.name}</h1><p>{profile.handle}</p></div></div>
      {editable ? <div className="profile-actions"><button type="button" className={`privacy-toggle ${visibility === 'public' ? 'public' : ''}`} disabled={privacyBusy} onClick={() => void changeVisibility()} aria-pressed={visibility === 'public'}>{visibility === 'public' ? <Globe2 /> : <Lock />}<span><strong>{visibility === 'public' ? 'Public profile' : 'Private profile'}</strong><small>{visibility === 'public' ? 'Anyone with the link can view' : 'Only you can view'}</small></span><i aria-hidden="true" /></button><button type="button" className="share-profile" onClick={() => void share()} disabled={visibility !== 'public'}><Share2 /> Share</button></div> : <div className="shared-profile-badge"><Globe2 /> Public profile</div>}
    </section>
    {notice && <div className="profile-notice" role="status"><Copy /> {notice}</div>}
    <section className="profile-shelves" aria-label={`${profile.name}'s shelves`}>
      {shelves.map((shelf) => {
        const mode = modes[shelf.type]
        const shownItems = mode === 'favorites' ? shelf.favorites : shelf.nextUp
        return <article className={`profile-shelf profile-shelf-${shelf.type}`} key={shelf.type}>
          <div className="profile-shelf-heading"><div className="profile-shelf-title"><MediaTypeIcon type={shelf.type} size={18} /><div><span>{shelfNames[shelf.type]} shelf</span><strong>{mode === 'favorites' ? shelf.completedCount : shelf.queueCount}</strong><small>{mode === 'favorites' ? completedLabels[shelf.type] : queueLabels[shelf.type]}</small></div></div><div className="profile-shelf-controls">{editable && <button type="button" className={`customize-showcase ${editing === shelf.type ? 'active' : ''}`} onClick={() => { setModes((current) => ({ ...current, [shelf.type]: 'favorites' })); setEditing(editing === shelf.type ? null : shelf.type) }} aria-label={`Customize ${shelfNames[shelf.type]} favorites`} title={`Customize ${shelfNames[shelf.type]} favorites`}><SquarePen /></button>}<div className="shelf-mode-toggle" role="group" aria-label={`${shelfNames[shelf.type]} shelf display`}><button type="button" className={mode === 'favorites' ? 'active' : ''} onClick={() => setModes((current) => ({ ...current, [shelf.type]: 'favorites' }))}><Star /> Favorites</button><button type="button" className={mode === 'priority' ? 'active' : ''} onClick={() => setModes((current) => ({ ...current, [shelf.type]: 'priority' }))}><Flag /> Next up</button></div></div></div>
          <div className="profile-shelf-content"><CoverStrip items={shownItems} label={mode === 'favorites' ? `Featured ${mediaTypeLabels[shelf.type]} favorites` : `Priority ${mediaTypeLabels[shelf.type]} titles`} onOpen={onOpen} /></div>
          {editing === shelf.type && <ShowcaseEditor shelf={shelf} initial={shelf.favorites.map((item) => item.id)} onCancel={() => setEditing(null)} onSave={async (ids) => onShowcasesChange?.({ ...showcases, [shelf.type]: ids })} />}
          <div className="shelf-edge" aria-hidden="true" />
        </article>
      })}
    </section>
  </div>
}
