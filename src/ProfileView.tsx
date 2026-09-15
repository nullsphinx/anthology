'use client'

import { useMemo, useState, type DragEvent } from 'react'
import { Check, Copy, Flag, Globe2, GripVertical, Lock, RotateCcw, Share2, SquarePen, Star, X } from 'lucide-react'
import { Avatar, MediaTypeIcon, Poster } from './components'
import { mediaTypeLabels, type LibraryEntry, type MediaItem, type MediaType, type Profile, type ProfileShowcases, type ProfileVisibility } from './domain'
import { buildProfileShelf, PROFILE_SHOWCASE_LIMIT, reorderShowcaseItems } from './profile'

const mediaTypes: MediaType[] = ['movie', 'show', 'book', 'album']
const shelfNames: Record<MediaType, string> = { movie: 'Movies', show: 'Television', book: 'Books', album: 'Albums' }
const completedLabels: Record<MediaType, string> = { movie: 'watched', show: 'watched', book: 'read', album: 'listened' }
const queueLabels: Record<MediaType, string> = { movie: 'watchlist', show: 'watchlist', book: 'to be read', album: 'listen later' }

type ShelfMode = 'favorites' | 'priority'
type EditingShelf = { type: MediaType; mode: ShelfMode }

type ProfileViewProps = {
  profile: Profile
  items: MediaItem[]
  entries: LibraryEntry[]
  editable?: boolean
  onOpen?: (item: MediaItem) => void
  onVisibilityChange?: (visibility: ProfileVisibility) => Promise<void>
  onShowcasesChange?: (showcases: ProfileShowcases) => Promise<void>
  onNextUpChange?: (showcases: ProfileShowcases) => Promise<void>
}

function CoverStrip({ items, label, onOpen, reorderable = false, onReorder }: { items: MediaItem[]; label: string; onOpen?: (item: MediaItem) => void; reorderable?: boolean; onReorder?: (draggedId: string, targetId: string, position: 'before' | 'after') => Promise<void> }) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const startDrag = (event: DragEvent<HTMLButtonElement>, itemId: string) => {
    setDraggedId(itemId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', itemId)
  }
  const drop = (event: DragEvent<HTMLButtonElement>, targetId: string) => {
    event.preventDefault()
    const sourceId = draggedId ?? event.dataTransfer.getData('text/plain')
    const bounds = event.currentTarget.getBoundingClientRect()
    const position = event.clientX >= bounds.left + bounds.width / 2 ? 'after' : 'before'
    setDraggedId(null)
    if (sourceId && sourceId !== targetId) void onReorder?.(sourceId, targetId, position)
  }

  return <div className={`profile-cover-strip ${reorderable ? 'reorderable' : ''}`} aria-label={label}>
    {Array.from({ length: PROFILE_SHOWCASE_LIMIT }, (_, index) => {
      const item = items[index]
      if (!item) return <div className="profile-cover-slot empty" key={`empty-${index}`} aria-hidden="true"><span>{index + 1}</span></div>
      return <button
        type="button"
        className={`profile-cover-slot ${draggedId === item.id ? 'dragging' : ''}`}
        key={item.id}
        onClick={() => onOpen?.(item)}
        disabled={!onOpen && !reorderable}
        aria-label={`${reorderable ? 'Drag to reorder or open' : 'Open'} ${item.title}`}
        title={reorderable ? `${item.title} · drag left or right to reorder` : item.title}
        draggable={reorderable}
        onDragStart={reorderable ? (event) => startDrag(event, item.id) : undefined}
        onDragEnd={reorderable ? () => setDraggedId(null) : undefined}
        onDragOver={reorderable ? (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' } : undefined}
        onDrop={reorderable ? (event) => drop(event, item.id) : undefined}
      ><Poster item={item} />{reorderable && <span className="cover-drag-handle" aria-hidden="true"><GripVertical /></span>}</button>
    })}
  </div>
}

function ShowcaseEditor({ candidates, initial, mode, onCancel, onSave }: { candidates: MediaItem[]; initial: string[]; mode: ShelfMode; onCancel: () => void; onSave: (ids: string[]) => Promise<void> }) {
  const [selected, setSelected] = useState(initial)
  const [saving, setSaving] = useState(false)
  const favorites = mode === 'favorites'
  const label = favorites ? 'favorites' : 'Next up titles'
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((candidate) => candidate !== id) : current.length < PROFILE_SHOWCASE_LIMIT ? [...current, id] : current)
  const save = async () => { setSaving(true); try { await onSave(selected); onCancel() } finally { setSaving(false) } }

  return <div className="showcase-editor">
    <div className="showcase-editor-heading"><div><strong>Choose up to twelve {label}</strong><span>{selected.length} of {PROFILE_SHOWCASE_LIMIT} selected{favorites ? ' · drag covers above to reorder after saving' : ''}</span></div><button type="button" onClick={onCancel} aria-label={`Close ${label} picker`}><X /></button></div>
    {candidates.length ? <div className="showcase-candidates">{candidates.map((item) => {
      const active = selected.includes(item.id)
      const disabled = !active && selected.length >= PROFILE_SHOWCASE_LIMIT
      return <button type="button" key={item.id} className={active ? 'selected' : ''} disabled={disabled} onClick={() => toggle(item.id)} aria-pressed={active}><Poster item={item} /><span>{item.title}</span>{active && <Check />}</button>
    })}</div> : <p className="showcase-empty">{favorites ? 'Mark completed titles as favorites to feature them here.' : 'Add titles to this shelf’s watchlist to feature them here.'}</p>}
    <div className="showcase-editor-actions"><button type="button" className="showcase-reset" onClick={() => setSelected([])}><RotateCcw /> Clear selection</button><button type="button" className="showcase-save" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save display'}</button></div>
  </div>
}

export function ProfileView({ profile, items, entries, editable = false, onOpen, onVisibilityChange, onShowcasesChange, onNextUpChange }: ProfileViewProps) {
  const [modes, setModes] = useState<Record<MediaType, ShelfMode>>({ movie: 'favorites', show: 'favorites', book: 'favorites', album: 'favorites' })
  const [editing, setEditing] = useState<EditingShelf | null>(null)
  const [privacyBusy, setPrivacyBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const favoriteShowcases = profile.showcaseItemIds ?? {}
  const nextUpShowcases = profile.nextUpItemIds ?? {}
  const shelves = useMemo(() => mediaTypes.map((type) => buildProfileShelf(type, items, entries, profile.id, favoriteShowcases, nextUpShowcases)), [entries, favoriteShowcases, items, nextUpShowcases, profile.id])
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

  const reorderFavorites = async (type: MediaType, ids: string[], draggedId: string, targetId: string, position: 'before' | 'after') => {
    if (!onShowcasesChange) return
    const reordered = reorderShowcaseItems(ids, draggedId, targetId, position)
    if (reordered === ids) return
    setNotice('')
    try { await onShowcasesChange({ ...favoriteShowcases, [type]: reordered }) }
    catch { setNotice('Favorite order could not be saved. Try again.') }
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
        const editorOpen = editing?.type === shelf.type && editing.mode === mode
        const candidates = mode === 'favorites' ? shelf.favoriteCandidates : shelf.nextUpCandidates
        const initial = shownItems.map((item) => item.id)
        const changeMode = (nextMode: ShelfMode) => { setModes((current) => ({ ...current, [shelf.type]: nextMode })); setEditing(null) }
        return <article className={`profile-shelf profile-shelf-${shelf.type}`} key={shelf.type}>
          <div className="profile-shelf-heading"><div className="profile-shelf-title"><MediaTypeIcon type={shelf.type} size={18} /><div><span>{shelfNames[shelf.type]} shelf</span><strong>{mode === 'favorites' ? shelf.completedCount : shelf.queueCount}</strong><small>{mode === 'favorites' ? completedLabels[shelf.type] : queueLabels[shelf.type]}</small></div></div><div className="profile-shelf-controls">{editable && <button type="button" className={`customize-showcase ${editorOpen ? 'active' : ''}`} onClick={() => setEditing(editorOpen ? null : { type: shelf.type, mode })} aria-label={`Customize ${shelfNames[shelf.type]} ${mode === 'favorites' ? 'favorites' : 'Next up'}`} title={`Customize ${shelfNames[shelf.type]} ${mode === 'favorites' ? 'favorites' : 'Next up'}`}><SquarePen /></button>}<div className="shelf-mode-toggle" role="group" aria-label={`${shelfNames[shelf.type]} shelf display`}><button type="button" className={mode === 'favorites' ? 'active' : ''} onClick={() => changeMode('favorites')}><Star /> Favorites</button><button type="button" className={mode === 'priority' ? 'active' : ''} onClick={() => changeMode('priority')}><Flag /> Next up</button></div></div></div>
          <div className="profile-shelf-content"><CoverStrip items={shownItems} label={mode === 'favorites' ? `Featured ${mediaTypeLabels[shelf.type]} favorites` : `Featured ${mediaTypeLabels[shelf.type]} Next up titles`} onOpen={onOpen} reorderable={editable && mode === 'favorites' && shownItems.length > 1} onReorder={(draggedId, targetId, position) => reorderFavorites(shelf.type, initial, draggedId, targetId, position)} /></div>
          {editorOpen && <ShowcaseEditor candidates={candidates} initial={initial} mode={mode} onCancel={() => setEditing(null)} onSave={async (ids) => mode === 'favorites' ? onShowcasesChange?.({ ...favoriteShowcases, [shelf.type]: ids }) : onNextUpChange?.({ ...nextUpShowcases, [shelf.type]: ids })} />}
          <div className="shelf-edge" aria-hidden="true" />
        </article>
      })}
    </section>
  </div>
}
