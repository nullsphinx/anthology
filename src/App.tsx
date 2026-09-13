'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Film,
  Layers3,
  Menu,
  Music2,
  RotateCw,
  Search,
  Sparkles,
  Tv,
  Users,
  X,
} from 'lucide-react'
import { browseCatalog, CATALOG_GENRES, fetchItemDetails, type CatalogSort } from './catalog'
import { Avatar, DetailPanel, MediaTable, MediaTypeIcon, StatusIcon } from './components'
import { group, profiles } from './data'
import {
  formatMinutes,
  getEntry,
  getGroupMetrics,
  getUserStats,
  mediaTypeLabels,
  statusLabels,
  type LibraryStatus,
  type MediaItem,
  type MediaType,
  type View,
} from './domain'
import { useMediaShelf } from './useMediaShelf'

const PAGE_SIZE = 100
const mediaTypes: MediaType[] = ['movie', 'show', 'book', 'album']
const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'library', label: 'Explore', icon: <Layers3 size={19} /> },
  { id: 'groups', label: 'Sunday Club', icon: <Users size={19} /> },
  { id: 'stats', label: 'My Year', icon: <BarChart3 size={19} /> },
]

const libraryMeta: Record<MediaType, { label: string; heading: string; description: string; empty: string; search: string }> = {
  movie: { label: 'Movies', heading: 'Your movies.', description: 'Your watchlist, viewing progress, completed films, and ratings in one place.', empty: 'No saved movies yet', search: 'Search your saved movies' },
  show: { label: 'Television', heading: 'Your television.', description: 'Every series you plan to watch, are watching, paused, completed, or stopped.', empty: 'No saved television yet', search: 'Search your saved television' },
  book: { label: 'Books', heading: 'Your books.', description: 'Your reading list, current reads, completed books, and unfinished titles.', empty: 'No saved books yet', search: 'Search your saved books' },
  album: { label: 'Albums', heading: 'Your albums.', description: 'Albums you plan to hear, are listening to, completed, paused, or stopped.', empty: 'No saved albums yet', search: 'Search your saved albums' },
}

const libraryStatusLabels: Record<MediaType, Record<LibraryStatus, string>> = {
  movie: { want: 'Watchlist', 'in-progress': 'Watching', paused: 'Paused', completed: 'Watched', dropped: 'Stopped watching' },
  show: { want: 'Watchlist', 'in-progress': 'Watching', paused: 'Paused', completed: 'Watched', dropped: 'Stopped watching' },
  book: { want: 'To be read', 'in-progress': 'Reading', paused: 'Paused', completed: 'Read', dropped: 'Did not finish' },
  album: { want: 'Listen later', 'in-progress': 'Listening', paused: 'Paused', completed: 'Listened', dropped: 'Stopped listening' },
}

function Nav({ view, libraryType, onChange, onExplore, onSelectLibrary, open, onClose }: { view: View; libraryType: MediaType | null; onChange: (view: View) => void; onExplore: () => void; onSelectLibrary: (type: MediaType) => void; open: boolean; onClose: () => void }) {
  const libraryTypes: Array<{ type: MediaType; label: string; icon: React.ReactNode }> = [
    { type: 'movie', label: 'Movies', icon: <Film /> },
    { type: 'show', label: 'Television', icon: <Tv /> },
    { type: 'book', label: 'Books', icon: <BookOpen /> },
    { type: 'album', label: 'Albums', icon: <Music2 /> },
  ]
  return <>
    {open && <button className="mobile-scrim" onClick={onClose} aria-label="Close navigation" />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand"><strong>Anthology</strong></div>
      <nav aria-label="Primary navigation"><span className="nav-label">Your space</span>{navItems.map((item) => { const active = item.id === 'library' ? view === 'library' && libraryType === null : view === item.id; return <button key={item.id} className={active ? 'active' : ''} onClick={() => { if (item.id === 'library') onExplore(); else onChange(item.id); onClose() }}>{item.icon}<span>{item.label}</span></button> })}</nav>
      <nav className="sidebar-types" aria-label="Media libraries"><span className="nav-label">Your library</span>{libraryTypes.map((item) => <button key={item.type} className={view === 'library' && libraryType === item.type ? 'active' : ''} onClick={() => { onSelectLibrary(item.type); onClose() }} aria-label={`Open ${item.label.toLowerCase()} library`}>{item.icon}<span>{item.label}</span></button>)}</nav>
      <div className="sidebar-note"><Sparkles size={17} /><div><strong>Deep catalogs connected</strong><span>TMDB, Open Library, and MusicBrainz.</span></div></div>
    </aside>
  </>
}

function Header({ currentUserId, onUserChange, onMenu, loading }: { currentUserId: string; onUserChange: (id: string) => void; onMenu: () => void; loading: boolean }) {
  const current = profiles.find((profile) => profile.id === currentUserId)!
  return <header className="topbar"><button className="menu-button" onClick={onMenu} aria-label="Open navigation"><Menu /></button><div className="catalog-health"><span className={loading ? 'catalog-dot loading' : 'catalog-dot'} /><strong>{loading ? 'Loading page' : 'Catalog online'}</strong><span>TMDB · Open Library · MusicBrainz</span></div><label className="profile-switcher"><span className="sr-only">Profile</span><Avatar profile={current} size="small" /><select value={currentUserId} onChange={(event) => onUserChange(event.target.value)}>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select><ChevronDown size={14} /></label></header>
}

function TypeFilters({ selected, onToggle, counts }: { selected: MediaType[]; onToggle: (type: MediaType | 'all') => void; counts: Record<MediaType, number> }) {
  const allSelected = selected.length === mediaTypes.length
  return <div className="type-filter" aria-label="Filter media types"><button className={allSelected ? 'active' : ''} onClick={() => onToggle('all')}>All media</button>{mediaTypes.map((type) => <button key={type} className={selected.includes(type) && !allSelected ? `active type-${type}` : ''} onClick={() => onToggle(type)}><MediaTypeIcon type={type} />{mediaTypeLabels[type]}<span>{counts[type] || 'live'}</span></button>)}</div>
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
  const counts: Record<MediaType, number> = {
    movie: items.filter((item) => item.type === 'movie').length,
    show: items.filter((item) => item.type === 'show').length,
    book: items.filter((item) => item.type === 'book').length,
    album: items.filter((item) => item.type === 'album').length,
  }
  const albumOnly = types.length === 1 && types[0] === 'album'
  const years = Array.from({ length: new Date().getFullYear() - 1919 }, (_, index) => new Date().getFullYear() - index)

  return <>
    <section className="library-intro"><div><span className="eyebrow">Comprehensive search · efficient browsing</span><h1>One shelf for every story.</h1><p>Browse 100 records at a time or search movies, television, books, and albums directly.</p></div><div className="catalog-total"><strong>100</strong><span>maximum rows and cover requests per page</span></div></section>
    <section className="table-console">
      <div className="console-topline"><div className="console-title"><strong>Explore catalog</strong><span>Find something new and add it to your library</span></div><div className="source-note"><span className="catalog-dot" /> Search and pages load on demand</div></div>
      <div className="search-row"><label className="catalog-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search any movie, TV show, book, or album" aria-label="Search the full media catalog" />{loading && query && <span className="search-spinner" />}{query && !loading && <button onClick={() => setQuery('')} aria-label="Clear search"><X /></button>}</label><label className="status-filter"><StatusIcon status={status === 'all' || status === 'untracked' ? 'want' : status} /><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => setStatusFilter(event.target.value as typeof status)}><option value="all">Every status</option><option value="untracked">Not added</option>{(Object.keys(statusLabels) as LibraryStatus[]).map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select><ChevronDown /></label></div>
      <TypeFilters selected={types} onToggle={toggleType} counts={counts} />
      <div className="advanced-filters">
        <label><span>Genre</span><select value={genre} onChange={(event) => setGenre(event.target.value)}><option value="">All genres</option>{[...CATALOG_GENRES].sort((a, b) => a.localeCompare(b)).map((value) => <option key={value}>{value}</option>)}</select><ChevronDown /></label>
        <label><span>Release year</span><select value={year ?? ''} onChange={(event) => setYear(event.target.value ? Number(event.target.value) : null)}><option value="">All years</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select><ChevronDown /></label>
        <label><span>Order</span><select value={albumOnly && sort === 'rating' ? 'popular' : sort} onChange={(event) => setSort(event.target.value as CatalogSort)}><option value="popular">{albumOnly ? 'Most listened' : 'Most popular'}</option>{!albumOnly && <option value="rating">Top rated</option>}<option value="title-asc">Title A–Z (page)</option><option value="title-desc">Title Z–A (page)</option></select><ChevronDown /></label>
        {(genre || year || sort !== 'popular') && <button className="clear-filters" onClick={() => { setGenre(''); setYear(null); setSort('popular') }}><X /> Clear filters</button>}
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

  return <div className="personal-library">
    <section className="library-intro"><div><span className={`eyebrow type-${type}`}><MediaTypeIcon type={type} /> Your {meta.label.toLowerCase()} library</span><h1>{meta.heading}</h1><p>{meta.description}</p></div><div className="catalog-total"><strong>{savedItems.length}</strong><span>saved {meta.label.toLowerCase()} in this profile</span></div></section>
    <section className="table-console">
      <div className="console-topline"><div className="console-title"><MediaTypeIcon type={type} /><div><strong>{meta.label}</strong><span>Personal library</span></div></div><div className="source-note"><span className="catalog-dot" /> Saved items only</div></div>
      <div className="library-status-tabs" aria-label={`${meta.label} status filters`}>
        <button className={status === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}><Layers3 /><span>All saved</span><strong>{savedItems.length}</strong></button>
        {(Object.keys(statusLabels) as LibraryStatus[]).map((value) => <button key={value} className={`${status === value ? 'active ' : ''}status-${value}`} onClick={() => setStatusFilter(value)}><StatusIcon status={value} /><span>{libraryStatusLabels[type][value]}</span><strong>{statusCounts[value]}</strong></button>)}
      </div>
      <div className="search-row library-search-row"><label className="catalog-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={meta.search} aria-label={meta.search} />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X /></button>}</label></div>
      <div className="advanced-filters">
        <label><span>Genre</span><select value={genre} onChange={(event) => setGenre(event.target.value)}><option value="">All genres</option>{genres.map((value) => <option key={value}>{value}</option>)}</select><ChevronDown /></label>
        <label><span>Release year</span><select value={year ?? ''} onChange={(event) => setYear(event.target.value ? Number(event.target.value) : null)}><option value="">All years</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select><ChevronDown /></label>
        <label><span>Order</span><select value={sort} onChange={(event) => setSort(event.target.value as PersonalSort)}><option value="updated">Recently updated</option><option value="rating">Your rating</option><option value="title-asc">Title A–Z</option><option value="title-desc">Title Z–A</option></select><ChevronDown /></label>
        {(genre || year || sort !== 'updated') && <button className="clear-filters" onClick={() => { setGenre(''); setYear(null); setSort('updated') }}><X /> Clear filters</button>}
      </div>
      <div className="result-line"><span><strong>{matches.length}</strong> saved {matches.length === 1 ? mediaTypeLabels[type].toLowerCase() : meta.label.toLowerCase()} match</span><span>Status and progress can be changed directly in the table</span></div>
      {items.length ? <MediaTable items={items} entries={shelf.state.entries} userId={shelf.state.currentUserId} onOpen={onOpen} onStatus={shelf.setStatus} /> : <EmptyTable scope="shelf" type={type} filtered={filtered} onExplore={onExplore} />}
      {(items.length > 0 || page > 1) && <Pagination page={page} hasNext={page < totalPages} loading={false} onPage={(value) => { setPage(value); window.scrollTo({ top: 180, behavior: 'smooth' }) }} />}
    </section>
  </div>
}

function GroupsView({ shelf, onOpen }: { shelf: ReturnType<typeof useMediaShelf>; onOpen: (item: MediaItem) => void }) {
  const metrics = getGroupMetrics(shelf.state.items, shelf.state.entries, group.memberIds).sort((a, b) => b.wanted - a.wanted || b.completed - a.completed)
  return <><section className="page-intro"><span className="eyebrow">Private group · 4 profiles</span><h1>{group.name}</h1><p>{group.description}</p><div className="avatar-stack">{profiles.map((profile) => <Avatar profile={profile} key={profile.id} />)}</div></section>{metrics.length ? <div className="matrix-wrap"><table className="overlap-table"><thead><tr><th>Title</th>{profiles.map((profile) => <th key={profile.id}><Avatar profile={profile} size="small" /><span>{profile.name}</span></th>)}</tr></thead><tbody>{metrics.map((metric) => <tr key={metric.item.id}><td><button onClick={() => onOpen(metric.item)}>{metric.item.title}<small>{metric.item.releaseInfo}</small></button></td>{profiles.map((profile) => { const entry = getEntry(shelf.state.entries, profile.id, metric.item.id); return <td key={profile.id}>{entry ? <span className={`matrix-state matrix-${entry.status}`} title={statusLabels[entry.status]}><StatusIcon status={entry.status} /></span> : <span className="table-dash">—</span>}</td> })}</tr>)}</tbody></table></div> : <div className="empty-state"><Users /><h3>No overlap yet</h3><p>Add real titles to profiles to start building the group matrix.</p></div>}</>
}

function StatsView({ shelf }: { shelf: ReturnType<typeof useMediaShelf> }) {
  const stats = getUserStats(shelf.state.items, shelf.state.entries, shelf.state.currentUserId)
  const rows = (Object.keys(statusLabels) as LibraryStatus[]).map((status) => ({ status, count: shelf.currentEntries.filter((entry) => entry.status === status).length }))
  return <><section className="page-intro"><span className="eyebrow">A living recap</span><h1>Your year in stories</h1><p>These numbers update from the real titles on your shelf.</p></section><div className="stats-strip"><div><span>Completed</span><strong>{stats.completed}</strong></div><div><span>Screen time</span><strong>{formatMinutes(stats.minutes)}</strong></div><div><span>Episodes</span><strong>{stats.episodes}</strong></div><div><span>Average rating</span><strong>{stats.averageRating ? (stats.averageRating / 20).toFixed(1) : '—'}</strong></div><div><span>Top genre</span><strong>{stats.topGenre}</strong></div></div><div className="status-ledger">{rows.map((row) => <div key={row.status}><span className={`status-symbol status-${row.status}`}><StatusIcon status={row.status} /></span><span>{statusLabels[row.status]}</span><strong>{row.count}</strong></div>)}</div></>
}

export function App() {
  const shelf = useMediaShelf()
  const [view, setView] = useState<View>('library')
  const [types, setTypes] = useState<MediaType[]>(mediaTypes)
  const [libraryType, setLibraryType] = useState<MediaType | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const openItem = async (item: MediaItem) => { setSelectedItem(item); setDetailLoading(true); try { const details = await fetchItemDetails(item); setSelectedItem((current) => current?.id === item.id ? details : current); if (getEntry(shelf.state.entries, shelf.state.currentUserId, item.id)) shelf.saveItemDetails(details) } catch { /* Keep the table record usable if optional details fail. */ } finally { setDetailLoading(false) } }
  const selectExplore = () => { setLibraryType(null); setView('library') }
  const selectLibraryType = (type: MediaType) => { setLibraryType(type); setCatalogLoading(false); setView('library') }
  const selectedEntry = selectedItem ? getEntry(shelf.state.entries, shelf.state.currentUserId, selectedItem.id) : undefined
  return <div className="app-shell"><Nav view={view} libraryType={libraryType} onChange={setView} onExplore={selectExplore} onSelectLibrary={selectLibraryType} open={navOpen} onClose={() => setNavOpen(false)} /><div className="app-main"><Header currentUserId={shelf.state.currentUserId} onUserChange={shelf.setCurrentUser} onMenu={() => setNavOpen(true)} loading={catalogLoading} /><main>{view === 'library' && (libraryType ? <PersonalLibraryView type={libraryType} shelf={shelf} onOpen={openItem} onExplore={selectExplore} onLoadingChange={setCatalogLoading} /> : <ExploreView shelf={shelf} onOpen={openItem} onLoadingChange={setCatalogLoading} types={types} onTypesChange={setTypes} />)}{view === 'groups' && <GroupsView shelf={shelf} onOpen={openItem} />}{view === 'stats' && <StatsView shelf={shelf} />}</main><footer className="app-footer"><span>Books from <a href="https://openlibrary.org/" target="_blank" rel="noreferrer">Open Library</a>. Albums and cover art from <a href="https://musicbrainz.org/" target="_blank" rel="noreferrer">MusicBrainz</a>, <a href="https://listenbrainz.org/" target="_blank" rel="noreferrer">ListenBrainz</a>, and the <a href="https://coverartarchive.org/" target="_blank" rel="noreferrer">Cover Art Archive</a>. This product uses the <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB API</a> but is not endorsed or certified by TMDB.</span><button onClick={shelf.resetShelf}>Clear local shelf</button></footer></div><nav className="mobile-tabs" aria-label="Mobile navigation">{navItems.map((item) => <button key={item.id} className={view === item.id && (item.id !== 'library' || libraryType === null) ? 'active' : ''} onClick={() => { if (item.id === 'library') selectExplore(); else setView(item.id) }}>{item.icon}<span>{item.label}</span></button>)}</nav>{selectedItem && <DetailPanel item={selectedItem} entry={selectedEntry} loading={detailLoading} onClose={() => setSelectedItem(null)} onStatus={(status) => shelf.setStatus(selectedItem, status)} onProgress={(progress) => shelf.setProgress(selectedItem, progress)} onRating={(rating) => shelf.setRating(selectedItem, rating)} onEpisode={(episode) => shelf.toggleEpisode(selectedItem, episode)} onSeason={(season) => shelf.toggleSeason(selectedItem, season)} onRemove={() => { shelf.removeItem(selectedItem.id); setSelectedItem(null) }} />}</div>
}
