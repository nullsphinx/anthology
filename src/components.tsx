import { useState } from 'react'
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  CircleCheck,
  CirclePause,
  CirclePlay,
  ExternalLink,
  Film,
  Flag,
  ImageOff,
  Minus,
  Music,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  Tv,
  X,
} from 'lucide-react'
import {
  MAX_REVIEW_LENGTH,
  getProgressLabel,
  getStatusLabel,
  mediaTypeLabels,
  normalizeReview,
  seasonEpisodeRange,
  totalEpisodes,
  type LibraryEntry,
  type LibraryStatus,
  type MediaItem,
  type MediaType,
  type Profile,
} from './domain'
import { getAvatarPreset } from './avatars'

function AvatarMotif({ symbol }: { symbol: NonNullable<ReturnType<typeof getAvatarPreset>['symbol']> }) {
  if (symbol === 'moon') return <><circle cx="33" cy="30" r="15" fill="var(--avatar-accent)" /><circle cx="40" cy="24" r="15" fill="var(--avatar-bg)" /><circle cx="19" cy="18" r="1.6" fill="var(--avatar-detail)" /><circle cx="46" cy="45" r="1.2" fill="var(--avatar-detail)" /></>
  if (symbol === 'orbit') return <><ellipse cx="32" cy="32" rx="23" ry="10" fill="none" stroke="var(--avatar-accent)" strokeWidth="2.4" transform="rotate(-22 32 32)" /><ellipse cx="32" cy="32" rx="11" ry="23" fill="none" stroke="var(--avatar-detail)" strokeWidth="1.7" transform="rotate(32 32 32)" /><circle cx="32" cy="32" r="7" fill="var(--avatar-accent)" /><circle cx="49" cy="19" r="3.5" fill="var(--avatar-detail)" /></>
  if (symbol === 'mountain') return <><circle cx="46" cy="18" r="6" fill="var(--avatar-detail)" /><path d="M6 52 24 24l10 15 7-9 17 22H6Z" fill="var(--avatar-accent)" /><path d="m17 35 7-11 5 8-5 4-3-3-4 2Z" fill="var(--avatar-detail)" opacity=".9" /></>
  if (symbol === 'waves') return <><path d="M7 22c8-7 16 7 25 0s17 7 25 0M7 32c8-7 16 7 25 0s17 7 25 0M7 42c8-7 16 7 25 0s17 7 25 0" fill="none" stroke="var(--avatar-accent)" strokeWidth="4" strokeLinecap="round" /><circle cx="17" cy="13" r="3" fill="var(--avatar-detail)" /></>
  if (symbol === 'sun') return <><circle cx="32" cy="32" r="11" fill="var(--avatar-accent)" /><g stroke="var(--avatar-detail)" strokeWidth="3" strokeLinecap="round"><path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6" /></g></>
  if (symbol === 'comet') return <><path d="M10 45 39 22M13 51l30-24M8 37l26-20" fill="none" stroke="var(--avatar-detail)" strokeWidth="3" strokeLinecap="round" opacity=".8" /><circle cx="44" cy="20" r="10" fill="var(--avatar-accent)" /><circle cx="47" cy="17" r="3" fill="var(--avatar-detail)" opacity=".55" /></>
  if (symbol === 'grid') return <>{[16, 32, 48].flatMap((x) => [16, 32, 48].map((y, index) => <rect key={`${x}-${y}`} x={x - 5} y={y - 5} width="10" height="10" rx="2.5" fill={(x + y + index) % 3 ? 'var(--avatar-accent)' : 'var(--avatar-detail)'} opacity={x === 32 && y === 32 ? 1 : .72} />))}</>
  if (symbol === 'prism') return <><path d="m31 12 16 36H15l16-36Z" fill="none" stroke="var(--avatar-accent)" strokeWidth="3" strokeLinejoin="round" /><path d="M3 30h18M42 30l17-8M42 34l18 2M40 38l16 10" fill="none" stroke="var(--avatar-detail)" strokeWidth="2.5" strokeLinecap="round" /><path d="M21 30h21" stroke="var(--avatar-accent)" strokeWidth="2" /></>
  if (symbol === 'flower') return <><g fill="var(--avatar-accent)"><ellipse cx="32" cy="17" rx="7" ry="12" /><ellipse cx="32" cy="47" rx="7" ry="12" /><ellipse cx="17" cy="32" rx="12" ry="7" /><ellipse cx="47" cy="32" rx="12" ry="7" /></g><circle cx="32" cy="32" r="8" fill="var(--avatar-detail)" /></>
  return <><path d="m32 10 3.3 9.5 10 .2-8 6 2.9 9.6-8.2-5.5-8.2 5.5 2.9-9.6-8-6 10-.2L32 10Z" fill="var(--avatar-accent)" /><circle cx="48" cy="42" r="4" fill="var(--avatar-detail)" /><circle cx="15" cy="43" r="2.5" fill="var(--avatar-detail)" /><circle cx="49" cy="13" r="2" fill="var(--avatar-accent)" /></>
}

export function Avatar({ profile, size = 'normal' }: { profile: Profile; size?: 'small' | 'normal' }) {
  const preset = getAvatarPreset(profile.avatar)
  return <span className={`avatar avatar-${size}`} style={{ '--avatar-bg': preset.background, '--avatar-skin': preset.skin, '--avatar-hair': preset.hair, '--avatar-shirt': preset.shirt, '--avatar-accent': preset.accent, '--avatar-detail': preset.detail } as React.CSSProperties} title={profile.name}>
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="32" fill="var(--avatar-bg)" />
      {preset.symbol ? <AvatarMotif symbol={preset.symbol} /> : <>
        <path d="M13 64c1.7-13.2 8.7-20.5 19-20.5S49.3 50.8 51 64H13Z" fill="var(--avatar-shirt)" />
        <circle cx="32" cy="28" r="14" fill="var(--avatar-skin)" />
        <path d="M18.5 27.5c0-11 5.7-17.5 14.2-17.5 8.4 0 14.3 6.5 14.3 16.8-3.2-1.1-6.3-3.9-8-7.1-4.8 5-11.9 7.2-20.5 7.8Z" fill="var(--avatar-hair)" />
        <path d="M24.2 32.5c2 3.6 4.6 5.3 7.8 5.3 3.1 0 5.7-1.7 7.8-5.3" fill="none" stroke="rgba(40,25,21,.55)" strokeWidth="1.5" strokeLinecap="round" />
      </>}
    </svg>
  </span>
}

export function MediaTypeIcon({ type, size = 15 }: { type: MediaType; size?: number }) {
  if (type === 'movie') return <Film size={size} />
  if (type === 'show') return <Tv size={size} />
  if (type === 'book') return <BookOpen size={size} />
  return <Music size={size} />
}

export function StatusIcon({ status, size = 15 }: { status: LibraryStatus; size?: number }) {
  if (status === 'want') return <Bookmark size={size} />
  if (status === 'in-progress') return <CirclePlay size={size} />
  if (status === 'paused') return <CirclePause size={size} />
  if (status === 'completed') return <CircleCheck size={size} />
  return <X size={size} />
}

export function Poster({ item, className = '' }: { item: MediaItem; className?: string }) {
  return (
    <span className={`poster ${className}`}>
      <span className="poster-fallback"><ImageOff size={17} /></span>
      {item.posterUrl && <img src={item.posterUrl} alt={`${item.title} ${item.type === 'book' || item.type === 'album' ? 'cover' : 'poster'}`} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true }} />}
    </span>
  )
}

const statusActions: LibraryStatus[] = ['want', 'in-progress', 'paused', 'completed', 'dropped']
const interactiveRowTargets = 'button, a, input, select, textarea, label'

function StatusControl({ item, entry, onStatus }: { item: MediaItem; entry?: LibraryEntry; onStatus: (item: MediaItem, status: LibraryStatus) => void }) {
  return (
    <div className="status-icon-picker" role="group" aria-label={`Status for ${item.title}`}>
      {statusActions.map((status) => {
        const label = getStatusLabel(status, item.type)
        const active = entry?.status === status
        return (
          <button
            key={status}
            type="button"
            data-status={status}
            className={active ? 'active' : ''}
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => onStatus(item, status)}
          >
            <StatusIcon status={status} />
          </button>
        )
      })}
    </div>
  )
}

function LibraryMarker({
  item,
  entry,
  onFavorite,
  onPriority,
}: {
  item: MediaItem
  entry: LibraryEntry
  onFavorite: (item: MediaItem) => void
  onPriority: (item: MediaItem) => void
}) {
  if (entry.status === 'want') {
    return (
      <button className={`library-marker ${entry.priority ? 'priority-active' : ''}`} onClick={() => onPriority(item)} aria-label={`Priority: ${item.title}`} aria-pressed={entry.priority} title="Mark as priority"><Flag fill={entry.priority ? 'currentColor' : 'none'} /></button>
    )
  }
  if (entry.status === 'completed') {
    return (
      <button className={`library-marker ${entry.favorite ? 'favorite-active' : ''}`} onClick={() => onFavorite(item)} aria-label={`Favorite: ${item.title}`} aria-pressed={entry.favorite} title="Mark as favorite"><Star fill={entry.favorite ? 'currentColor' : 'none'} /></button>
    )
  }
  return <span className="table-dash">—</span>
}

function TallyMarks({ count }: { count: number }) {
  const groups = Array.from({ length: Math.ceil(count / 5) }, (_, index) => Math.min(5, count - index * 5))
  return (
    <span className="tally-display" aria-hidden="true">
      {groups.map((marks, groupIndex) => (
        <span className="tally-group" key={groupIndex}>
          {Array.from({ length: Math.min(4, marks) }, (_, markIndex) => <i key={markIndex} />)}
          {marks === 5 && <b />}
        </span>
      ))}
    </span>
  )
}

function CompletionCounter({
  item,
  entry,
  onCompletionCount,
}: {
  item: MediaItem
  entry: LibraryEntry
  onCompletionCount: (item: MediaItem, change: number) => void
}) {
  if (entry.status !== 'completed') return <span className="table-dash">—</span>
  const count = Math.max(1, entry.completionCount)
  const completionLabel = item.type === 'book' ? 'reads' : item.type === 'album' ? 'listens' : 'watches'
  return (
    <div className="completion-counter" role="group" aria-label={`${count} ${completionLabel} for ${item.title}`} title={`${count} ${completionLabel}`}>
      <button onClick={() => onCompletionCount(item, -1)} disabled={count <= 1} aria-label={`Remove one completion; currently ${count}`}><Minus /></button>
      <TallyMarks count={count} />
      <span className="sr-only">{count} {completionLabel}</span>
      <button onClick={() => onCompletionCount(item, 1)} disabled={count >= 99} aria-label={`Add one completion; currently ${count}`}><Plus /></button>
    </div>
  )
}

export function MediaTable({
  items,
  entries,
  userId,
  onOpen,
  onStatus,
  libraryMode = false,
  onFavorite,
  onPriority,
  onCompletionCount,
}: {
  items: MediaItem[]
  entries: LibraryEntry[]
  userId: string
  onOpen: (item: MediaItem) => void
  onStatus: (item: MediaItem, status: LibraryStatus) => void
  libraryMode?: boolean
  onFavorite?: (item: MediaItem) => void
  onPriority?: (item: MediaItem) => void
  onCompletionCount?: (item: MediaItem, change: number) => void
}) {
  return (
    <div className="media-table-wrap">
      <table className={`media-table ${libraryMode ? 'library-media-table' : ''}`}>
        <thead><tr><th className="cover-column">Cover</th><th className="title-column">Title</th><th className="type-column">Type</th><th className="release-column">Release</th>{libraryMode && <th className="marker-column"><span className="desktop-column-label">Favorite / priority</span><span className="mobile-column-label">Mark</span></th>}<th className="status-column">Status</th>{libraryMode && <th className="completion-column"><span className="desktop-column-label">Completed count</span><span className="mobile-column-label">Count</span></th>}<th className="progress-column">Progress</th><th className="rating-column">Your rating</th><th className="community-column">Community</th></tr></thead>
        <tbody>{items.map((item) => {
          const entry = entries.find((candidate) => candidate.userId === userId && candidate.itemId === item.id)
          return (
            <tr
              key={item.id}
              data-item-title={item.title}
              tabIndex={0}
              aria-label={`Open details for ${item.title}`}
              onClick={(event) => {
                const target = event.target as Element
                if (!target.closest(interactiveRowTargets)) onOpen(item)
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
                event.preventDefault()
                onOpen(item)
              }}
            >
              <td className="cover-cell"><button className="poster-cell" onClick={() => onOpen(item)} aria-label={`Open ${item.title}`}><Poster item={item} /></button></td>
              <td className="title-cell"><button onClick={() => onOpen(item)}><strong>{item.title}</strong><span>{item.type === 'book' || item.type === 'album' ? item.creator : item.genres.length ? item.genres.slice(0, 3).join(' · ') : 'Full credits available in details'}</span></button></td>
              <td className="type-cell"><span className={`type-label type-${item.type}`}><MediaTypeIcon type={item.type} />{mediaTypeLabels[item.type]}</span></td>
              <td className="release-cell muted-cell">{item.releaseInfo || item.year || '—'}</td>
              {libraryMode && <td className="marker-cell">{entry && onFavorite && onPriority ? <LibraryMarker item={item} entry={entry} onFavorite={onFavorite} onPriority={onPriority} /> : <span className="table-dash">—</span>}</td>}
              <td className="status-cell"><StatusControl item={item} entry={entry} onStatus={onStatus} /></td>
              {libraryMode && <td className="completion-cell">{entry && onCompletionCount ? <CompletionCounter item={item} entry={entry} onCompletionCount={onCompletionCount} /> : <span className="table-dash">—</span>}</td>}
              <td className="progress-cell">{entry ? <div className="table-progress"><span>{getProgressLabel(item, entry)}</span>{entry.status !== 'want' && <i><b style={{ width: `${entry.progress}%` }} /></i>}</div> : <span className="table-dash">—</span>}</td>
              <td className="rating-cell">{entry?.rating ? <span className="personal-rating"><Star size={13} fill="currentColor" />{entry.rating / 20}</span> : <span className="table-dash">—</span>}</td>
              <td className="community-cell">{item.communityRating ? <span className="community-rating"><Star size={13} />{item.communityRating}</span> : <span className="table-dash">—</span>}</td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

function ReviewEditor({ review, onSave }: { review: string; onSave: (review: string) => void }) {
  const [draft, setDraft] = useState(review)
  const count = Array.from(draft).length
  const dirty = draft !== review
  return (
    <div className="control-section review-section">
      <div className="section-label-row"><h3>Your review</h3><span>Optional</span></div>
      <textarea
        aria-label="Your review"
        aria-describedby="review-help review-count"
        value={draft}
        rows={4}
        spellCheck="true"
        placeholder="Add a short review…"
        onChange={(event) => setDraft(normalizeReview(event.target.value))}
      />
      <div className="review-meta">
        <span id="review-help">Plain text only</span>
        <span id="review-count" aria-live="polite">{count} / {MAX_REVIEW_LENGTH}</span>
      </div>
      <button className="review-save" disabled={!dirty} onClick={() => onSave(draft)}>Save review</button>
    </div>
  )
}

export function DetailPanel({
  item,
  entry,
  loading,
  onClose,
  onStatus,
  onProgress,
  onRating,
  onReview,
  onEpisode,
  onSeason,
  onRemove,
}: {
  item: MediaItem
  entry?: LibraryEntry
  loading: boolean
  onClose: () => void
  onStatus: (status: LibraryStatus) => void
  onProgress: (progress: number) => void
  onRating: (stars: number) => void
  onReview: (review: string) => void
  onEpisode: (episode: number) => void
  onSeason: (season: number) => void
  onRemove: () => void
}) {
  const total = totalEpisodes(item)
  const repeatAction = item.type === 'book' ? 'Read again' : item.type === 'album' ? 'Listen again' : 'Watch again'
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="detail-drawer" role="dialog" aria-modal="true" aria-label={`${item.title} details`}>
        <button className="drawer-close" onClick={onClose} aria-label="Close details"><X /></button>
        <div className="drawer-hero">
          <Poster item={item} className="drawer-poster" />
          <div className="drawer-heading">
            <span className="eyebrow"><MediaTypeIcon type={item.type} /> {mediaTypeLabels[item.type]} · {item.releaseInfo}</span>
            <h2>{item.title}</h2>
            <p>{item.creator}</p>
            <div className="genre-row">{item.genres.map((genre) => <span key={genre}>{genre}</span>)}</div>
            {item.communityRating && <span className="drawer-community"><Star size={14} fill="currentColor" /> {item.communityRating} community rating</span>}
          </div>
        </div>

        {loading ? <div className="detail-loading"><span /> Loading complete metadata…</div> : <p className="drawer-summary">{item.summary}</p>}

        <div className="status-action-grid">
          {statusActions.map((status) => <button key={status} data-status={status} className={entry?.status === status ? 'active' : ''} onClick={() => onStatus(status)}><StatusIcon status={status} />{getStatusLabel(status, item.type)}</button>)}
        </div>

        {entry?.completionCount ? <div className="history-callout"><RotateCcw size={17} /><span>Completed {entry.completionCount === 1 ? 'once' : `${entry.completionCount} times`}.</span>{entry.status === 'completed' && <button onClick={() => onStatus('in-progress')}>{repeatAction} <ChevronRight size={15} /></button>}</div> : null}

        {entry && <div className="control-section">
          <div className="section-label-row"><h3>Your progress</h3><span>{getProgressLabel(item, entry)}</span></div>
          <input aria-label="Quick progress estimate" type="range" min="0" max="100" step="1" value={entry.progress} onChange={(event) => onProgress(Number(event.target.value))} />
          <div className="range-labels"><span>Not started</span><span>Quick estimate</span><span>Finished</span></div>
        </div>}

        {entry && <div className="control-section">
          <div className="section-label-row"><h3>Your rating</h3><span>{entry.rating ? `${entry.rating / 20} / 5` : 'Not rated'}</span></div>
          <div className="rating-control" role="group" aria-label="Choose a rating">
            <Star size={21} fill="currentColor" />
            <div className="rating-options">{Array.from({ length: 10 }, (_, index) => (index + 1) / 2).map((stars) => <button key={stars} className={(entry.rating ?? 0) / 20 === stars ? 'active' : ''} onClick={() => onRating(stars)} aria-label={`${stars} stars`}>{Number.isInteger(stars) ? stars : `${Math.floor(stars)}½`}</button>)}</div>
            <button className="rating-clear" onClick={() => onRating(0)}>Clear</button>
          </div>
        </div>}

        {entry ? <ReviewEditor key={item.id} review={entry.review ?? ''} onSave={onReview} /> : <div className="control-section review-section review-locked"><div className="section-label-row"><h3>Your review</h3><span>Optional</span></div><p>Add this title to your library to write a review.</p></div>}

        {entry && item.type === 'show' && item.seasons && <div className="episode-section">
          <div className="section-label-row"><h3>Released episodes</h3><span>{entry.watchedEpisodes.length} of {total} watched</span></div>
          {item.seasons.map((season) => {
            const range = seasonEpisodeRange(item, season.number)
            const watched = range.filter((episode) => entry.watchedEpisodes.includes(episode)).length
            return <div className="season-block" key={season.number}><div className="season-heading"><div><strong>Season {season.number}</strong><span>{watched}/{season.episodes} watched</span></div><button onClick={() => onSeason(season.number)}>{watched === season.episodes ? 'Clear season' : 'Mark season watched'}</button></div><div className="episode-grid">{range.map((episode, index) => { const isWatched = entry.watchedEpisodes.includes(episode); return <button key={episode} className={isWatched ? 'watched' : ''} onClick={() => onEpisode(episode)} aria-label={`Season ${season.number} episode ${index + 1}${isWatched ? ', watched' : ''}`}>{isWatched ? <Check size={13} /> : index + 1}</button> })}</div></div>
          })}
        </div>}

        <footer className="drawer-footer">
          <a href={item.providerUrl} target="_blank" rel="noreferrer">View source record <ExternalLink size={13} /></a>
          <span>Metadata: {item.provider}</span>
          {entry && <button className="remove-button" onClick={onRemove}><Trash2 size={13} /> Remove from shelf</button>}
        </footer>
      </section>
    </div>
  )
}
