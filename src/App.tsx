'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers3,
  LogOut,
  Menu,
  RotateCw,
  Search,
  Users,
  X,
} from 'lucide-react'
import { avatarPresets, normalizeAvatarPreset } from './avatars'
import { browseCatalog, CATALOG_GENRES, fetchCatalogCounts, fetchItemDetails, type CatalogCounts, type CatalogSort } from './catalog'
import { Avatar, DetailPanel, MediaTable, MediaTypeIcon, StatusIcon } from './components'
import { group, profiles } from './data'
import {
  getEntry,
  getGroupMetrics,
  getUserStats,
  mediaTypeLabels,
  statusLabels,
  type LibraryStatus,
  type MediaItem,
  type MediaType,
  type Profile,
  type View,
} from './domain'
import { useMediaShelf } from './useMediaShelf'

const PAGE_SIZE = 100
const mediaTypes: MediaType[] = ['movie', 'show', 'book', 'album']
const GITHUB_URL = 'https://github.com/nullsphinx/anthology'
const AVATAR_STORAGE_KEY = 'anthology-avatar-presets-v1'
const navItems: { id: View; label: string }[] = [
  { id: 'library', label: 'Explore' },
  { id: 'groups', label: 'Community' },
  { id: 'stats', label: 'Stats' },
]
const libraryTypes: Array<{ type: MediaType; label: string }> = [
  { type: 'movie', label: 'Movies' },
  { type: 'show', label: 'Television' },
  { type: 'book', label: 'Books' },
  { type: 'album', label: 'Albums' },
]

function GitHubMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .8a11.4 11.4 0 0 0-3.6 22.2c.6.1.8-.2.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.6.1-3.1 0 0 1-.3 3.1 1.2A10.8 10.8 0 0 1 12 6.5c1.1 0 2.1.1 3.1.4 2.2-1.5 3.1-1.2 3.1-1.2.6 1.5.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.8 5.5-5.5 5.8.4.4.8 1.1.8 2.2v2.5c0 .4.2.7.8.6A11.4 11.4 0 0 0 12 .8Z" /></svg>
}

function loadAvatarSelections(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const saved = JSON.parse(window.localStorage.getItem(AVATAR_STORAGE_KEY) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, string] => typeof entry[1] === 'string').map(([userId, avatar]) => [userId, normalizeAvatarPreset(avatar)]))
  } catch {
    return {}
  }
}

const libraryMeta: Record<MediaType, { label: string; heading: string; description: string; empty: string; search: string }> = {
  movie: { label: 'Movies', heading: 'Movies shelf', description: 'Your watchlist, viewing progress, completed films, and ratings in one place.', empty: 'No saved movies yet', search: 'Search your saved movies' },
  show: { label: 'Television', heading: 'Television shelf', description: 'Every series you plan to watch, are watching, paused, completed, or stopped.', empty: 'No saved television yet', search: 'Search your saved television' },
  book: { label: 'Books', heading: 'Books shelf', description: 'Your reading list, current reads, completed books, and unfinished titles.', empty: 'No saved books yet', search: 'Search your saved books' },
  album: { label: 'Albums', heading: 'Albums shelf', description: 'Albums you plan to hear, are listening to, completed, paused, or stopped.', empty: 'No saved albums yet', search: 'Search your saved albums' },
}

const libraryStatusLabels: Record<MediaType, Record<LibraryStatus, string>> = {
  movie: { want: 'Watchlist', 'in-progress': 'Watching', paused: 'Paused', completed: 'Watched', dropped: 'Stopped watching' },
  show: { want: 'Watchlist', 'in-progress': 'Watching', paused: 'Paused', completed: 'Watched', dropped: 'Stopped watching' },
  book: { want: 'To be read', 'in-progress': 'Reading', paused: 'Paused', completed: 'Read', dropped: 'Did not finish' },
  album: { want: 'Listen later', 'in-progress': 'Listening', paused: 'Paused', completed: 'Listened', dropped: 'Stopped listening' },
}

function Header({ view, libraryType, current, account, onUserChange, onAvatarChange, onSignOut, onChange, onExplore, onSelectLibrary, menuOpen, onToggleMenu, onCloseMenu }: { view: View; libraryType: MediaType | null; current: Profile; account?: Profile; onUserChange: (id: string) => void; onAvatarChange: (avatar: string) => Promise<void>; onSignOut?: () => void; onChange: (view: View) => void; onExplore: () => void; onSelectLibrary: (type: MediaType) => void; menuOpen: boolean; onToggleMenu: () => void; onCloseMenu: () => void }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const navigate = (item: View) => { if (item === 'library') onExplore(); else onChange(item); onCloseMenu() }
  const chooseAvatar = async (avatar: string) => {
    setAvatarError('')
    try { await onAvatarChange(avatar); setProfileOpen(false) } catch { setAvatarError('That profile picture could not be saved. Try again.') }
  }

  return <header className="site-header"><div className="topbar">
    <button className="brand-button" onClick={onExplore}>Anthology</button>
    <button className="menu-button" onClick={onToggleMenu} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen}>{menuOpen ? <X /> : <Menu />}</button>
    <nav className={`top-navigation ${menuOpen ? 'top-navigation-open' : ''}`} aria-label="Primary navigation">
      {navItems.map((item) => <button key={item.id} className={view === item.id && (item.id !== 'library' || libraryType === null) ? 'active' : ''} onClick={() => navigate(item.id)}>{item.label}</button>)}
      {libraryTypes.map((item) => <button key={item.type} className={view === 'library' && libraryType === item.type ? 'active' : ''} onClick={() => { onSelectLibrary(item.type); onCloseMenu() }}>{item.label}</button>)}
    </nav>
    <div className="header-actions">
      <button className={`header-icon-link about-link ${view === 'about' ? 'active' : ''}`} onClick={() => navigate('about')} aria-label="About Anthology" title="About Anthology"><Info /></button>
      <a className="header-icon-link github-link" href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="View Anthology on GitHub" title="View on GitHub"><GitHubMark /></a>
      <div className="profile-menu">
        <button className="profile-trigger" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-label="Choose profile picture"><Avatar profile={current} size="small" /><span>{current.name}</span><ChevronDown /></button>
        {profileOpen && <div className="avatar-popover">
          <div className="avatar-popover-heading"><strong>Profile picture</strong><span>Choose from twenty portraits and designs</span></div>
          {!account && <label className="preview-profile"><span>Preview profile</span><select value={current.id} onChange={(event) => onUserChange(event.target.value)}>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select><ChevronDown /></label>}
          <div className="avatar-options" role="group" aria-label="Profile picture options">{avatarPresets.map((preset) => {
            const optionProfile = { ...current, name: preset.label, avatar: preset.id }
            const selected = normalizeAvatarPreset(current.avatar) === preset.id
            return <button key={preset.id} className={selected ? 'selected' : ''} onClick={() => void chooseAvatar(preset.id)} aria-label={preset.label} aria-pressed={selected}><Avatar profile={optionProfile} />{selected && <Check />}</button>
          })}</div>
          {avatarError && <span className="avatar-error" role="alert">{avatarError}</span>}
          {account && onSignOut && <button className="sign-out-button" onClick={onSignOut}><LogOut /> Sign out</button>}
        </div>}
      </div>
    </div>
  </div></header>
}

function TypeFilters({ selected, onToggle }: { selected: MediaType[]; onToggle: (type: MediaType | 'all') => void }) {
  const allSelected = selected.length === mediaTypes.length
  return <div className="type-filter" aria-label="Filter media types"><button className={allSelected ? 'active' : ''} onClick={() => onToggle('all')}>All media</button>{mediaTypes.map((type) => <button key={type} className={selected.includes(type) && !allSelected ? `active type-${type}` : ''} onClick={() => onToggle(type)}><MediaTypeIcon type={type} />{mediaTypeLabels[type]}</button>)}</div>
}

function EmptyTable({ scope, type, filtered, onExplore }: { scope: 'catalog' | 'shelf'; type?: MediaType; filtered?: boolean; onExplore?: () => void }) {
  const meta = type ? libraryMeta[type] : null
  const heading = scope === 'catalog' ? 'No matching titles on this page' : filtered ? `No ${meta?.label.toLowerCase()} match these filters` : meta?.empty ?? 'Your shelf is empty'
  const copy = scope === 'catalog' ? 'Adjust a filter, try another title, or continue to another catalog page.' : filtered ? 'Clear or change a filter to see more of your saved items.' : `Use Explore to find and save ${meta?.label.toLowerCase() ?? 'media'} first.`
  return <div className="empty-state"><Search /><h3>{heading}</h3><p>{copy}</p>{scope === 'shelf' && !filtered && onExplore && <button className="empty-action" onClick={onExplore}>Explore catalog</button>}</div>
}

function Pagination({ page, hasNext, loading, onPage }: { page: number; hasNext: boolean; loading: boolean; onPage: (page: number) => void }) {
  return <nav className="pagination" aria-label="Catalog pages"><button disabled={page === 1 || loading} onClick={() => onPage(page - 1)}><ChevronLeft /> Previous</button><span><strong>Page {page}</strong><small>Up to {PAGE_SIZE} records per page</small></span><button disabled={!hasNext || loading} onClick={() => onPage(page + 1)}>Next <ChevronRight /></button></nav>
}

function ExploreView({ shelf, onOpen, onLoadingChange, types, onTypesChange }: { shelf: ReturnType<typeof useMediaShelf>; onOpen: (item: MediaItem) => void; onLoadingChange: (loading: boolean) => void; types: MediaType[]; onTypesChange: (types: MediaType[]) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatusFilter] = useState<'all' | 'untracked' | LibraryStatus>('all')
  const [genre, setGenre] = useState('')
  const [year, setYear] = useState<number | null>(null)
  const [sort, setSort] = useState<CatalogSort>('popular')
  const [page, setPage] = useState(1)
  const [catalogItems, setCatalogItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasNext, setHasNext] = useState(true)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => setPage(1), [query, types, genre, year, sort, status])

  useEffect(() => {
    const supported = types.some((type) => type === 'movie' || type === 'show' || type === 'book' || type === 'album')
    if (!supported) { setCatalogItems([]); setHasNext(false); setLoading(false); onLoadingChange(false); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true); onLoadingChange(true); setError(null)
      browseCatalog({ page, pageSize: PAGE_SIZE, types, query, genre, year, sort }, controller.signal)
        .then((result) => { setCatalogItems(result.items); setHasNext(result.hasNext) })
        .catch((catalogError: unknown) => { if ((catalogError as Error).name !== 'AbortError') { setError('The live catalog did not respond. Your saved shelf is still available.'); setCatalogItems([]) } })
        .finally(() => { if (!controller.signal.aborted) { setLoading(false); onLoadingChange(false) } })
    }, query.trim() ? 350 : 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [page, types, query, genre, year, sort, retryKey, onLoadingChange])

  const toggleType = (type: MediaType | 'all') => {
    if (type === 'all') { onTypesChange(mediaTypes); return }
    const base = types.length === mediaTypes.length ? [] : types
    if (base.includes(type)) onTypesChange(base.length === 1 ? base : base.filter((candidate) => candidate !== type))
    else onTypesChange([...base, type])
  }

  const items = useMemo(() => catalogItems.filter((item) => {
    const entry = getEntry(shelf.state.entries, shelf.state.currentUserId, item.id)
    return status === 'all' || (status === 'untracked' ? !entry : entry?.status === status)
  }), [catalogItems, shelf.state.entries, shelf.state.currentUserId, status])
  const albumOnly = types.length === 1 && types[0] === 'album'
  const effectiveSort = albumOnly && sort === 'rating' ? 'popular' : sort
  const orderLabel = effectiveSort === 'popular' ? (albumOnly ? 'Most listened' : 'Most popular') : effectiveSort === 'rating' ? 'Top rated' : effectiveSort === 'title-asc' ? 'Title A–Z' : 'Title Z–A'
  const years = Array.from({ length: new Date().getFullYear() - 1919 }, (_, index) => new Date().getFullYear() - index)

  return <>
    <section className="library-intro"><div><span className="eyebrow">Comprehensive search</span><h1>Explore all media</h1><p>Browse 100 records at a time or search movies, television, books, and albums directly.</p></div><div className="catalog-total"><strong>100</strong><span>maximum rows and cover requests per page</span></div></section>
    <section className="table-console">
      <div className="console-topline"><div className="console-title"><strong>Explore catalog</strong><span>Find something new and add it to your library</span></div><div className="source-note"><span className="catalog-dot" /> Search and pages load on demand</div></div>
      <div className="search-row"><label className="catalog-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search any movie, TV show, book, or album" aria-label="Search the full media catalog" />{loading && query && <span className="search-spinner" />}{query && !loading && <button onClick={() => setQuery('')} aria-label="Clear search"><X /></button>}</label><label className="status-filter"><StatusIcon status={status === 'all' || status === 'untracked' ? 'want' : status} /><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => setStatusFilter(event.target.value as typeof status)}><option value="all">Every status</option><option value="untracked">Not added</option>{(Object.keys(statusLabels) as LibraryStatus[]).map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select><ChevronDown /></label></div>
      <div className="filter-toolbar">
        <TypeFilters selected={types} onToggle={toggleType} />
        <div className="advanced-filters">
          <label><span>Genre</span><strong className="filter-value">{genre || 'All genres'}</strong><select aria-label="Genre" value={genre} onChange={(event) => setGenre(event.target.value)}><option value="">All genres</option>{[...CATALOG_GENRES].sort((a, b) => a.localeCompare(b)).map((value) => <option key={value}>{value}</option>)}</select><ChevronDown /></label>
          <label><span>Release year</span><strong className="filter-value">{year ?? 'All years'}</strong><select aria-label="Release year" value={year ?? ''} onChange={(event) => setYear(event.target.value ? Number(event.target.value) : null)}><option value="">All years</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select><ChevronDown /></label>
          <label><span>Order</span><strong className="filter-value">{orderLabel}</strong><select aria-label="Order" value={effectiveSort} onChange={(event) => setSort(event.target.value as CatalogSort)}><option value="popular">{albumOnly ? 'Most listened' : 'Most popular'}</option>{!albumOnly && <option value="rating">Top rated</option>}<option value="title-asc">Title A–Z (page)</option><option value="title-desc">Title Z–A (page)</option></select><ChevronDown /></label>
          {(genre || year || sort !== 'popular') && <button className="clear-filters" onClick={() => { setGenre(''); setYear(null); setSort('popular') }}><X /> Clear filters</button>}
        </div>
      </div>
      <div className="result-line"><span><strong>{items.length}</strong> records on page {page}{query.trim() ? ' from title search' : genre || year ? ' matching active filters' : ''}</span><span>Provider-backed pagination has no client-side record ceiling</span></div>
      {error && <div className="error-banner"><span>{error}</span><button onClick={() => setRetryKey((value) => value + 1)}><RotateCw /> Retry page</button></div>}
      {loading ? <div className="table-skeleton" aria-label="Loading catalog page">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div> : items.length ? <MediaTable items={items} entries={shelf.state.entries} userId={shelf.state.currentUserId} onOpen={onOpen} onStatus={shelf.setStatus} /> : <EmptyTable scope="catalog" filtered={Boolean(query || genre || year || status !== 'all')} />}
      {!loading && !error && (items.length > 0 || page > 1 || hasNext) && <Pagination page={page} hasNext={hasNext} loading={loading} onPage={(value) => { setPage(value); window.scrollTo({ top: 180, behavior: 'smooth' }) }} />}
    </section>
  </>
}

type PersonalSort = 'updated' | 'rating' | 'title-asc' | 'title-desc'

function PersonalLibraryView({ type, shelf, onOpen, onExplore, onLoadingChange }: { type: MediaType; shelf: ReturnType<typeof useMediaShelf>; onOpen: (item: MediaItem) => void; onExplore: () => void; onLoadingChange: (loading: boolean) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatusFilter] = useState<'all' | LibraryStatus>('all')
  const [genre, setGenre] = useState('')
  const [year, setYear] = useState<number | null>(null)
  const [sort, setSort] = useState<PersonalSort>('updated')
  const [page, setPage] = useState(1)
  const meta = libraryMeta[type]

  useEffect(() => { onLoadingChange(false) }, [onLoadingChange])
  useEffect(() => { setQuery(''); setStatusFilter('all'); setGenre(''); setYear(null); setSort('updated'); setPage(1) }, [type])
  useEffect(() => setPage(1), [query, status, genre, year, sort])

  const savedItems = useMemo(() => shelf.state.items.filter((item) => item.type === type && Boolean(getEntry(shelf.state.entries, shelf.state.currentUserId, item.id))), [shelf.state.items, shelf.state.entries, shelf.state.currentUserId, type])
  const statusCounts = useMemo(() => (Object.keys(statusLabels) as LibraryStatus[]).reduce((counts, value) => ({ ...counts, [value]: savedItems.filter((item) => getEntry(shelf.state.entries, shelf.state.currentUserId, item.id)?.status === value).length }), {} as Record<LibraryStatus, number>), [savedItems, shelf.state.entries, shelf.state.currentUserId])
  const matches = useMemo(() => {
    const lowered = query.trim().toLowerCase()
    return savedItems.filter((item) => {
      const entry = getEntry(shelf.state.entries, shelf.state.currentUserId, item.id)
      return (!lowered || `${item.title} ${item.creator} ${item.genres.join(' ')}`.toLowerCase().includes(lowered)) && (status === 'all' || entry?.status === status) && (!genre || item.genres.includes(genre)) && (!year || item.year === year)
    }).sort((a, b) => {
      if (sort === 'title-asc') return a.title.localeCompare(b.title)
      if (sort === 'title-desc') return b.title.localeCompare(a.title)
      const aEntry = getEntry(shelf.state.entries, shelf.state.currentUserId, a.id)
      const bEntry = getEntry(shelf.state.entries, shelf.state.currentUserId, b.id)
      if (sort === 'rating') return (bEntry?.rating ?? -1) - (aEntry?.rating ?? -1)
      return Date.parse(bEntry?.updatedAt ?? '') - Date.parse(aEntry?.updatedAt ?? '')
    })
  }, [savedItems, shelf.state.entries, shelf.state.currentUserId, query, status, genre, year, sort])
  const genres = useMemo(() => [...new Set(savedItems.flatMap((item) => item.genres))].sort((a, b) => a.localeCompare(b)), [savedItems])
  const years = useMemo(() => [...new Set(savedItems.map((item) => item.year).filter((value): value is number => value !== null))].sort((a, b) => b - a), [savedItems])
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const items = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(query || status !== 'all' || genre || year)
  const orderLabel = sort === 'updated' ? 'Recently updated' : sort === 'rating' ? 'Your rating' : sort === 'title-asc' ? 'Title A–Z' : 'Title Z–A'

  return <div className="personal-library">
    <section className="library-intro"><div><span className={`eyebrow type-${type}`}><MediaTypeIcon type={type} /> Your {meta.label.toLowerCase()} library</span><h1>{meta.heading}</h1><p>{meta.description}</p></div><div className="catalog-total"><strong>{savedItems.length}</strong><span>saved {meta.label.toLowerCase()} in this profile</span></div></section>
    <section className="table-console">
      <div className="console-topline"><div className="console-title"><MediaTypeIcon type={type} /><div><strong>{meta.label}</strong><span>Personal library</span></div></div><div className="source-note"><span className="catalog-dot" /> Saved items only</div></div>
      <div className="search-row library-search-row"><label className="catalog-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={meta.search} aria-label={meta.search} />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X /></button>}</label></div>
      <div className="filter-toolbar library-filter-toolbar">
        <div className="library-status-tabs" aria-label={`${meta.label} status filters`}>
          <button className={status === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}><Layers3 /><span>All saved</span><strong>{savedItems.length}</strong></button>
          {(Object.keys(statusLabels) as LibraryStatus[]).map((value) => <button key={value} className={`${status === value ? 'active ' : ''}status-${value}`} onClick={() => setStatusFilter(value)}><StatusIcon status={value} /><span>{libraryStatusLabels[type][value]}</span><strong>{statusCounts[value]}</strong></button>)}
        </div>
        <div className="advanced-filters">
          <label><span>Genre</span><strong className="filter-value">{genre || 'All genres'}</strong><select aria-label="Genre" value={genre} onChange={(event) => setGenre(event.target.value)}><option value="">All genres</option>{genres.map((value) => <option key={value}>{value}</option>)}</select><ChevronDown /></label>
          <label><span>Release year</span><strong className="filter-value">{year ?? 'All years'}</strong><select aria-label="Release year" value={year ?? ''} onChange={(event) => setYear(event.target.value ? Number(event.target.value) : null)}><option value="">All years</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select><ChevronDown /></label>
          <label><span>Order</span><strong className="filter-value">{orderLabel}</strong><select aria-label="Order" value={sort} onChange={(event) => setSort(event.target.value as PersonalSort)}><option value="updated">Recently updated</option><option value="rating">Your rating</option><option value="title-asc">Title A–Z</option><option value="title-desc">Title Z–A</option></select><ChevronDown /></label>
          {(genre || year || sort !== 'updated') && <button className="clear-filters" onClick={() => { setGenre(''); setYear(null); setSort('updated') }}><X /> Clear filters</button>}
        </div>
      </div>
      <div className="result-line"><span><strong>{matches.length}</strong> saved {matches.length === 1 ? mediaTypeLabels[type].toLowerCase() : meta.label.toLowerCase()} match</span><span>Status and progress can be changed directly in the table</span></div>
      {items.length ? <MediaTable items={items} entries={shelf.state.entries} userId={shelf.state.currentUserId} onOpen={onOpen} onStatus={shelf.setStatus} libraryMode onFavorite={shelf.toggleFavorite} onPriority={shelf.togglePriority} onCompletionCount={shelf.adjustCompletionCount} /> : <EmptyTable scope="shelf" type={type} filtered={filtered} onExplore={onExplore} />}
      {(items.length > 0 || page > 1) && <Pagination page={page} hasNext={page < totalPages} loading={false} onPage={(value) => { setPage(value); window.scrollTo({ top: 180, behavior: 'smooth' }) }} />}
    </section>
  </div>
}

function GroupsView({ shelf, onOpen }: { shelf: ReturnType<typeof useMediaShelf>; onOpen: (item: MediaItem) => void }) {
  const metrics = getGroupMetrics(shelf.state.items, shelf.state.entries, group.memberIds).sort((a, b) => b.wanted - a.wanted || b.completed - a.completed)
  return <><section className="page-intro"><span className="eyebrow">Create clubs and share with community</span><h1>Community</h1><p>{group.description}</p><div className="avatar-stack">{profiles.map((profile) => <Avatar profile={profile} key={profile.id} />)}</div></section>{metrics.length ? <div className="matrix-wrap"><table className="overlap-table"><thead><tr><th>Title</th>{profiles.map((profile) => <th key={profile.id}><Avatar profile={profile} size="small" /><span>{profile.name}</span></th>)}</tr></thead><tbody>{metrics.map((metric) => <tr key={metric.item.id}><td><button onClick={() => onOpen(metric.item)}>{metric.item.title}<small>{metric.item.releaseInfo}</small></button></td>{profiles.map((profile) => { const entry = getEntry(shelf.state.entries, profile.id, metric.item.id); return <td key={profile.id}>{entry ? <span className={`matrix-state matrix-${entry.status}`} title={statusLabels[entry.status]}><StatusIcon status={entry.status} /></span> : <span className="table-dash">—</span>}</td> })}</tr>)}</tbody></table></div> : <div className="empty-state"><Users /><h3>No community overlap yet</h3><p>Add real titles to profiles to start building the community matrix.</p></div>}</>
}

function StatsView({ shelf }: { shelf: ReturnType<typeof useMediaShelf> }) {
  const [type, setType] = useState<MediaType | 'all'>('all')
  const [year, setYear] = useState<number | null>(null)
  const years = useMemo(() => [...new Set(shelf.currentEntries.map((entry) => new Date(entry.completedAt ?? entry.updatedAt).getFullYear()).filter(Number.isFinite))].sort((a, b) => b - a), [shelf.currentEntries])
  const scoped = useMemo(() => shelf.currentEntries.flatMap((entry) => {
    const item = shelf.state.items.find((candidate) => candidate.id === entry.itemId)
    if (!item || (type !== 'all' && item.type !== type)) return []
    if (year && new Date(entry.completedAt ?? entry.updatedAt).getFullYear() !== year) return []
    return [{ entry, item }]
  }), [shelf.currentEntries, shelf.state.items, type, year])
  const stats = getUserStats(shelf.state.items, shelf.state.entries, shelf.state.currentUserId, { type, year })
  const statusRows = (Object.keys(statusLabels) as LibraryStatus[]).map((status) => ({ status, label: statusLabels[status], count: scoped.filter(({ entry }) => entry.status === status).length }))
  const typeRows = mediaTypes.map((mediaType) => ({ type: mediaType, label: libraryMeta[mediaType].label, count: scoped.filter(({ item }) => item.type === mediaType).length }))
  const genres = [...scoped.reduce((counts, { item }) => {
    item.genres.forEach((genre) => counts.set(genre, (counts.get(genre) ?? 0) + 1))
    return counts
  }, new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const ratings = [1, 2, 3, 4, 5].map((stars) => ({ stars, count: scoped.filter(({ entry }) => entry.rating && Math.ceil(entry.rating / 20) === stars).length }))
  const favorites = scoped.filter(({ entry }) => entry.favorite).length
  const priorities = scoped.filter(({ entry }) => entry.priority && entry.status === 'want').length
  const maxBreakdown = Math.max(1, ...(type === 'all' ? typeRows.map((row) => row.count) : genres.map(([, count]) => count)))
  const maxRating = Math.max(1, ...ratings.map((row) => row.count))
  const timelineYear = year ?? (years.length === 1 ? years[0] : null)
  const timeline = timelineYear
    ? Array.from({ length: 12 }, (_, month) => ({ label: new Date(2024, month, 1).toLocaleString('en', { month: 'short' }), count: scoped.filter(({ entry }) => { const date = new Date(entry.completedAt ?? entry.updatedAt); return date.getFullYear() === timelineYear && date.getMonth() === month }).length }))
    : [...years].reverse().map((value) => ({ label: String(value), count: scoped.filter(({ entry }) => new Date(entry.completedAt ?? entry.updatedAt).getFullYear() === value).length }))
  const timelineMax = Math.max(1, ...timeline.map((point) => point.count))
  const timelinePoints = timeline.map((point, index) => {
    const x = timeline.length === 1 ? 300 : 18 + (index * 564) / Math.max(1, timeline.length - 1)
    const y = 142 - (point.count / timelineMax) * 112
    return `${x},${y}`
  }).join(' ')
  const statusColors: Record<LibraryStatus, string> = { want: '#b39ddb', 'in-progress': '#ffab91', paused: '#ffd54f', completed: '#81c784', dropped: '#ef9a9a' }
  let position = 0
  const donutSegments = statusRows.filter((row) => row.count).map((row) => {
    const start = position
    position += (row.count / Math.max(1, scoped.length)) * 100
    return `${statusColors[row.status]} ${start}% ${position}%`
  })

  return <div className="stats-page">
    <section className="page-intro stats-intro"><div><span className="eyebrow">Your library statistics</span><h1>Statistics</h1><p>Explore your full history or focus on one year and one kind of media.</p></div></section>
    <div className="filter-toolbar stats-filter-toolbar"><div className="stats-type-filter" role="group" aria-label="Filter stats by media type"><button className={type === 'all' ? 'active' : ''} onClick={() => setType('all')}><Layers3 />All media</button>{mediaTypes.map((mediaType) => <button key={mediaType} className={type === mediaType ? `active type-${mediaType}` : ''} onClick={() => setType(mediaType)}><MediaTypeIcon type={mediaType} />{libraryMeta[mediaType].label}</button>)}</div><label className="stats-year"><span>Year</span><strong className="filter-value">{year ?? 'All time'}</strong><select aria-label="Year" value={year ?? ''} onChange={(event) => setYear(event.target.value ? Number(event.target.value) : null)}><option value="">All time</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select><ChevronDown /></label></div>
    <div className="stats-strip"><div><span>Saved</span><strong>{scoped.length}</strong></div><div><span>Completed</span><strong>{stats.completed}</strong></div><div><span>Favorites</span><strong>{favorites}</strong></div><div><span>Priority</span><strong>{priorities}</strong></div><div><span>Average rating</span><strong>{stats.averageRating ? (stats.averageRating / 20).toFixed(1) : '—'}</strong></div></div>
    <div className="stats-grid">
      <section className="chart-card status-chart"><header><div><span>Library status</span><strong>Where everything stands</strong></div><small>{scoped.length} total</small></header><div className="donut-layout"><div className="donut" style={{ background: donutSegments.length ? `conic-gradient(${donutSegments.join(',')})` : '#2c2c2c' }}><span><strong>{stats.completed}</strong><small>complete</small></span></div><div className="chart-legend">{statusRows.map((row) => <div key={row.status}><i style={{ background: statusColors[row.status] }} /><span>{row.label}</span><strong>{row.count}</strong></div>)}</div></div></section>
      <section className="chart-card"><header><div><span>{type === 'all' ? 'Media mix' : 'Top genres'}</span><strong>{type === 'all' ? 'Across the whole collection' : `Within ${libraryMeta[type].label.toLowerCase()}`}</strong></div><small>{stats.topGenre !== '—' ? `Top: ${stats.topGenre}` : 'No data'}</small></header><div className="horizontal-bars">{(type === 'all' ? typeRows.map((row) => ({ key: row.type, label: row.label, count: row.count, icon: <MediaTypeIcon type={row.type} /> })) : genres.map(([genre, count]) => ({ key: genre, label: genre, count, icon: null }))).map((row) => <div key={row.key}><span>{row.icon}{row.label}</span><i><b style={{ width: `${(row.count / maxBreakdown) * 100}%` }} /></i><strong>{row.count}</strong></div>)}</div></section>
      <section className="chart-card rating-chart"><header><div><span>Rating distribution</span><strong>Your scores at a glance</strong></div><small>{stats.rated} rated</small></header><div className="vertical-bars">{ratings.map((row) => <div key={row.stars}><span><i style={{ height: `${(row.count / maxRating) * 100}%` }} /></span><strong>{row.stars}★</strong><small>{row.count}</small></div>)}</div></section>
      <section className="chart-card timeline-chart"><header><div><span>Library activity</span><strong>{timelineYear ? `${timelineYear} by month` : 'Saved items by year'}</strong></div><small>{stats.rewatches} repeat completions</small></header>{timeline.length ? <><svg viewBox="0 0 600 160" role="img" aria-label="Library activity line chart"><line x1="18" x2="582" y1="142" y2="142" /><polyline points={timelinePoints} />{timelinePoints.split(' ').map((point, index) => { const [cx, cy] = point.split(','); return <circle key={`${cx}-${cy}-${index}`} cx={cx} cy={cy} r="4" /> })}</svg><div className="timeline-labels">{timeline.map((point) => <span key={point.label}>{point.label}</span>)}</div></> : <div className="chart-empty">Add items to start your timeline.</div>}</section>
    </div>
  </div>
}

function AboutView() {
  const [counts, setCounts] = useState<CatalogCounts>({ movies: null, television: null, books: null, albums: null })
  const [countsLoaded, setCountsLoaded] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetchCatalogCounts(controller.signal)
      .then(setCounts)
      .finally(() => { if (!controller.signal.aborted) setCountsLoaded(true) })
    return () => controller.abort()
  }, [])
  const countLabel = (count: number | null, minimum = false) => count === null ? (countsLoaded ? 'Unavailable' : 'Loading…') : `${new Intl.NumberFormat('en-US').format(count)}${minimum ? '+' : ''}`
  const dataRows = [
    { source: <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a>, media: 'Movies', count: counts.movies, minimum: true },
    { source: <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a>, media: 'Television', count: counts.television, minimum: true },
    { source: <a href="https://openlibrary.org/" target="_blank" rel="noreferrer">Open Library</a>, media: 'Books', count: counts.books, minimum: false },
    { source: <><a href="https://musicbrainz.org/" target="_blank" rel="noreferrer">MusicBrainz</a><span> with ListenBrainz and Cover Art Archive</span></>, media: 'Albums', count: counts.albums, minimum: false },
  ]
  return <div className="about-page">
    <section className="about-section about-intro"><h1>About</h1><p>Anthology is a free and open-source project for users to catalogue movies, television, books, and albums. Personal profiles and library entries are private by default, but may be shared with other users or the wider Anthology community to compare and contrast what friends and others are watching, reading, or listening to.</p></section>
    <section className="about-section"><h2>Data</h2><div className="about-table-wrap"><table className="about-table"><thead><tr><th>Source</th><th>Media</th><th>Count</th></tr></thead><tbody>{dataRows.map((row) => <tr key={row.media}><td>{row.source}</td><td>{row.media}</td><td>{countLabel(row.count, row.minimum)}</td></tr>)}</tbody></table></div><p className="data-note">Counts reflect provider catalog totals and may change as those catalogs are updated. A plus sign denotes a provider-reported result ceiling rather than the full searchable catalog. This product uses the TMDB API but is not endorsed or certified by TMDB.</p></section>
    <section className="about-section"><h2>Project</h2><ul className="project-list"><li>Next.js 16 App Router, React 19, and TypeScript</li><li>Supabase Postgres, Auth, and row-level security</li><li>Vercel deployment and GitHub Actions CI</li><li><a href={GITHUB_URL} target="_blank" rel="noreferrer">Contribute on GitHub</a></li></ul></section>
    <section className="about-section"><h2>Privacy</h2><p>Anthology stores the account information and library data you choose to add. Profiles and entries are private by default, and Anthology does not sell personal data. Information you explicitly share is visible only to the audience you select. Contact us with privacy questions or account and data deletion requests.</p></section>
    <section className="about-section"><h2>Contact</h2><p><a href="mailto:anthologyshelf@proton.me">anthologyshelf@proton.me</a></p></section>
  </div>
}

export function App({ account, onSignOut, onAvatarChange }: { account?: Profile; onSignOut?: () => void; onAvatarChange?: (avatar: string) => Promise<void> } = {}) {
  const shelf = useMediaShelf(account?.id)
  const [view, setView] = useState<View>('library')
  const [types, setTypes] = useState<MediaType[]>(mediaTypes)
  const [libraryType, setLibraryType] = useState<MediaType | null>(null)
  const [, setCatalogLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [avatarSelections, setAvatarSelections] = useState<Record<string, string>>({})
  useEffect(() => setAvatarSelections(loadAvatarSelections()), [])
  const openItem = async (item: MediaItem) => { setSelectedItem(item); setDetailLoading(true); try { const details = await fetchItemDetails(item); setSelectedItem((current) => current?.id === item.id ? details : current); if (getEntry(shelf.state.entries, shelf.state.currentUserId, item.id)) shelf.saveItemDetails(details) } catch { /* Keep the table record usable if optional details fail. */ } finally { setDetailLoading(false) } }
  const selectExplore = () => { setLibraryType(null); setView('library') }
  const selectLibraryType = (type: MediaType) => { setLibraryType(type); setCatalogLoading(false); setView('library') }
  const baseProfile = account ?? profiles.find((profile) => profile.id === shelf.state.currentUserId) ?? profiles[0]
  const currentProfile = { ...baseProfile, avatar: avatarSelections[baseProfile.id] ?? normalizeAvatarPreset(baseProfile.avatar) }
  const changeAvatar = async (avatar: string) => {
    const selected = normalizeAvatarPreset(avatar)
    const previous = avatarSelections[baseProfile.id]
    const next = { ...avatarSelections, [baseProfile.id]: selected }
    setAvatarSelections(next)
    window.localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(next))
    try { await onAvatarChange?.(selected) } catch (error) {
      const reverted = { ...next }
      if (previous) reverted[baseProfile.id] = previous
      else delete reverted[baseProfile.id]
      setAvatarSelections(reverted)
      window.localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(reverted))
      throw error
    }
  }
  const selectedEntry = selectedItem ? getEntry(shelf.state.entries, shelf.state.currentUserId, selectedItem.id) : undefined
  return <div className="app-shell"><Header view={view} libraryType={libraryType} current={currentProfile} account={account} onUserChange={shelf.setCurrentUser} onAvatarChange={changeAvatar} onSignOut={onSignOut} onChange={setView} onExplore={selectExplore} onSelectLibrary={selectLibraryType} menuOpen={navOpen} onToggleMenu={() => setNavOpen((open) => !open)} onCloseMenu={() => setNavOpen(false)} /><div className="app-main">{shelf.syncError && <div className="sync-error" role="alert"><span>{shelf.syncError}</span><button onClick={shelf.clearSyncError}>Dismiss</button></div>}<main>{view === 'library' && (libraryType ? <PersonalLibraryView type={libraryType} shelf={shelf} onOpen={openItem} onExplore={selectExplore} onLoadingChange={setCatalogLoading} /> : <ExploreView shelf={shelf} onOpen={openItem} onLoadingChange={setCatalogLoading} types={types} onTypesChange={setTypes} />)}{view === 'groups' && <GroupsView shelf={shelf} onOpen={openItem} />}{view === 'stats' && <StatsView shelf={shelf} />}{view === 'about' && <AboutView />}</main><footer className="app-footer"><span>Anthology © 2026 · <a href={`${GITHUB_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer">AGPL-3.0</a></span>{!account && <button onClick={shelf.resetShelf}>Clear local shelf</button>}</footer></div>{selectedItem && <DetailPanel item={selectedItem} entry={selectedEntry} loading={detailLoading} onClose={() => setSelectedItem(null)} onStatus={(status) => shelf.setStatus(selectedItem, status)} onProgress={(progress) => shelf.setProgress(selectedItem, progress)} onRating={(rating) => shelf.setRating(selectedItem, rating)} onReview={(review) => shelf.setReview(selectedItem, review)} onEpisode={(episode) => shelf.toggleEpisode(selectedItem, episode)} onSeason={(season) => shelf.toggleSeason(selectedItem, season)} onRemove={() => { shelf.removeItem(selectedItem.id); setSelectedItem(null) }} />}</div>
}
