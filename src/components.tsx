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
  ImageOff,
  MoreHorizontal,
  Music2,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  Tv,
  X,
} from 'lucide-react'
import {
  getProgressLabel,
  getStatusLabel,
  mediaTypeLabels,
  seasonEpisodeRange,
  statusLabels,
  totalEpisodes,
  type LibraryEntry,
  type LibraryStatus,
  type MediaItem,
  type MediaType,
  type Profile,
} from './domain'

export function Avatar({ profile, size = 'normal' }: { profile: Profile; size?: 'small' | 'normal' }) {
  return <span className={`avatar avatar-${size}`} style={{ '--avatar-color': profile.color } as React.CSSProperties} title={profile.name}>{profile.initials}</span>
}

export function MediaTypeIcon({ type, size = 15 }: { type: MediaType; size?: number }) {
  if (type === 'movie') return <Film size={size} />
  if (type === 'show') return <Tv size={size} />
  if (type === 'book') return <BookOpen size={size} />
  return <Music2 size={size} />
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

function StatusControl({ item, entry, onStatus }: { item: MediaItem; entry?: LibraryEntry; onStatus: (item: MediaItem, status: LibraryStatus) => void }) {
  if (!entry) {
    return <button className="add-button" onClick={() => onStatus(item, 'want')} aria-label={`Add ${item.title} to your shelf`}><Plus size={15} /> Add</button>
  }
  return (
    <label className={`status-control status-${entry.status}`}>
      <StatusIcon status={entry.status} />
      <span className="sr-only">Status for {item.title}</span>
      <select value={entry.status} onChange={(event) => onStatus(item, event.target.value as LibraryStatus)}>
        {(Object.keys(statusLabels) as LibraryStatus[]).map((status) => <option key={status} value={status}>{getStatusLabel(status, item.type)}</option>)}
      </select>
    </label>
  )
}

export function MediaTable({
  items,
  entries,
  userId,
  onOpen,
  onStatus,
}: {
  items: MediaItem[]
  entries: LibraryEntry[]
  userId: string
  onOpen: (item: MediaItem) => void
  onStatus: (item: MediaItem, status: LibraryStatus) => void
}) {
  return (
    <div className="media-table-wrap">
      <table className="media-table">
        <thead><tr><th className="cover-column">Cover</th><th>Title</th><th>Type</th><th>Release</th><th>Status</th><th>Progress</th><th>Your rating</th><th>Community</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{items.map((item) => {
          const entry = entries.find((candidate) => candidate.userId === userId && candidate.itemId === item.id)
          return (
            <tr key={item.id} data-item-title={item.title}>
              <td><button className="poster-cell" onClick={() => onOpen(item)} aria-label={`Open ${item.title}`}><Poster item={item} /></button></td>
              <td className="title-cell"><button onClick={() => onOpen(item)}><strong>{item.title}</strong><span>{item.type === 'book' || item.type === 'album' ? item.creator : item.genres.length ? item.genres.slice(0, 3).join(' · ') : 'Full credits available in details'}</span></button></td>
              <td><span className={`type-label type-${item.type}`}><MediaTypeIcon type={item.type} />{mediaTypeLabels[item.type]}</span></td>
              <td className="muted-cell">{item.releaseInfo || item.year || '—'}</td>
              <td><StatusControl item={item} entry={entry} onStatus={onStatus} /></td>
              <td>{entry ? <div className="table-progress"><span>{getProgressLabel(item, entry)}</span>{entry.status !== 'want' && <i><b style={{ width: `${entry.progress}%` }} /></i>}</div> : <span className="table-dash">—</span>}</td>
              <td>{entry?.rating ? <span className="personal-rating"><Star size={13} fill="currentColor" />{entry.rating / 20}</span> : <span className="table-dash">—</span>}</td>
              <td>{item.communityRating ? <span className="community-rating"><Star size={13} />{item.communityRating}</span> : <span className="table-dash">—</span>}</td>
              <td><button className="more-button" onClick={() => onOpen(item)} aria-label={`More options for ${item.title}`}><MoreHorizontal /></button></td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

const statusActions: LibraryStatus[] = ['want', 'in-progress', 'paused', 'completed', 'dropped']

export function DetailPanel({
  item,
  entry,
  loading,
  onClose,
  onStatus,
  onProgress,
  onRating,
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
          {statusActions.map((status) => <button key={status} className={entry?.status === status ? 'active' : ''} onClick={() => onStatus(status)}><StatusIcon status={status} />{getStatusLabel(status, item.type)}</button>)}
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
