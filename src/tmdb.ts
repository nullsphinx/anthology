import type { BrowseCatalogOptions, CatalogPage, CatalogSort } from './catalog'
import type { MediaItem, MediaType, Season } from './domain'

const TMDB_PAGE_SIZE = 20
const POSTER_BASE = 'https://image.tmdb.org/t/p/w342'
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780'
const responseCache = new Map<string, unknown>()

const movieGenres: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
}

const tvGenres: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 10762: 'Kids', 9648: 'Mystery',
  10763: 'News', 10764: 'Reality', 10765: 'Science Fiction & Fantasy', 10766: 'Soap',
  10767: 'Talk', 10768: 'War & Politics', 37: 'Western',
}

const discoverGenreIds: Record<string, { movie?: number; show?: number }> = {
  Action: { movie: 28, show: 10759 },
  Adventure: { movie: 12, show: 10759 },
  Animation: { movie: 16, show: 16 },
  Comedy: { movie: 35, show: 35 },
  Crime: { movie: 80, show: 80 },
  Documentary: { movie: 99, show: 99 },
  Drama: { movie: 18, show: 18 },
  Family: { movie: 10751, show: 10751 },
  Fantasy: { movie: 14, show: 10765 },
  History: { movie: 36 },
  Horror: { movie: 27 },
  Kids: { show: 10762 },
  Music: { movie: 10402 },
  Mystery: { movie: 9648, show: 9648 },
  News: { show: 10763 },
  Reality: { show: 10764 },
  Romance: { movie: 10749 },
  'Science Fiction': { movie: 878, show: 10765 },
  Soap: { show: 10766 },
  Talk: { show: 10767 },
  Thriller: { movie: 53 },
  'TV Movie': { movie: 10770 },
  War: { movie: 10752, show: 10768 },
  Western: { movie: 37, show: 37 },
}

interface TmdbPage<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

interface TmdbCatalogRecord {
  id: number
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  popularity?: number
}

interface TmdbGenre { id: number; name: string }
interface TmdbCrew { job?: string; name: string }

interface TmdbDetails extends TmdbCatalogRecord {
  genres?: TmdbGenre[]
  runtime?: number | null
  episode_run_time?: number[]
  last_air_date?: string
  status?: string
  seasons?: Array<{ season_number: number; episode_count: number; name: string }>
  created_by?: Array<{ name: string }>
  credits?: { crew?: TmdbCrew[] }
  external_ids?: { imdb_id?: string | null }
}

export class TmdbUnavailableError extends Error {
  constructor() {
    super('TMDB is not configured or unavailable')
    this.name = 'TmdbUnavailableError'
  }
}

function typePath(type: 'movie' | 'show'): 'movie' | 'tv' {
  return type === 'show' ? 'tv' : 'movie'
}

function normalizedGenres(type: 'movie' | 'show', ids: number[] = []): string[] {
  const lookup = type === 'movie' ? movieGenres : tvGenres
  return ids.map((id) => lookup[id]).filter((value): value is string => Boolean(value))
}

function yearFromDate(value?: string): number | null {
  const year = Number(value?.slice(0, 4))
  return Number.isInteger(year) && year > 1800 ? year : null
}

function normalizeTmdbRecord(record: TmdbCatalogRecord, type: 'movie' | 'show', rank?: number): MediaItem {
  const releaseDate = type === 'movie' ? record.release_date : record.first_air_date
  const year = yearFromDate(releaseDate)
  const rating = Number(record.vote_average)
  return {
    id: `tmdb:${type}:${record.id}`,
    externalId: String(record.id),
    title: record.title ?? record.name ?? 'Untitled',
    type,
    year,
    releaseInfo: year ? (type === 'show' ? `${year}–` : String(year)) : 'Release year unavailable',
    genres: normalizedGenres(type, record.genre_ids),
    summary: record.overview?.trim() || 'Open the title to load full metadata.',
    creator: 'Credits available in details',
    posterUrl: record.poster_path ? `${POSTER_BASE}${record.poster_path}` : undefined,
    backdropUrl: record.backdrop_path ? `${BACKDROP_BASE}${record.backdrop_path}` : undefined,
    communityRating: Number.isFinite(rating) && rating > 0 ? Math.round(rating * 10) / 10 : null,
    provider: 'TMDB',
    providerUrl: `https://www.themoviedb.org/${typePath(type)}/${record.id}`,
    catalogRank: rank,
  }
}

async function tmdbFetch<T>(path: string, params: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const url = `/api/tmdb/3/${path}?${params}`
  const cached = responseCache.get(url)
  if (cached) return cached as T
  const response = await fetch(url, { signal })
  if (response.status === 404 || response.status === 502 || response.status === 503) throw new TmdbUnavailableError()
  if (!response.ok) throw new Error(`TMDB request failed (${response.status})`)
  const data = await response.json() as T
  responseCache.set(url, data)
  return data
}

function sortValue(sort: CatalogSort, type: 'movie' | 'show'): string {
  if (sort === 'rating') return 'vote_average.desc'
  if (sort === 'title-asc') return type === 'movie' ? 'original_title.asc' : 'name.asc'
  if (sort === 'title-desc') return type === 'movie' ? 'original_title.desc' : 'name.desc'
  return 'popularity.desc'
}

function localOrder(items: MediaItem[], sort: CatalogSort, query?: string): MediaItem[] {
  if (sort === 'rating') return items.sort((a, b) => (b.communityRating ?? -1) - (a.communityRating ?? -1) || a.title.localeCompare(b.title))
  if (sort === 'title-asc' || sort === 'title-desc') {
    const direction = sort === 'title-asc' ? 1 : -1
    return items.sort((a, b) => a.title.localeCompare(b.title) * direction)
  }
  if (query) {
    const lowered = query.toLowerCase()
    return items.sort((a, b) => {
      const score = (title: string) => title === lowered ? 0 : title.startsWith(lowered) ? 1 : 2
      return score(a.title.toLowerCase()) - score(b.title.toLowerCase()) || (a.catalogRank ?? Number.MAX_SAFE_INTEGER) - (b.catalogRank ?? Number.MAX_SAFE_INTEGER)
    })
  }
  return items
}

async function fetchTypeWindow(
  type: 'movie' | 'show',
  options: BrowseCatalogOptions,
  start: number,
  count: number,
  signal?: AbortSignal,
): Promise<{ items: MediaItem[]; hasNext: boolean; fetched: number }> {
  const query = options.query?.trim()
  const firstProviderPage = query ? 1 : Math.floor(start / TMDB_PAGE_SIZE) + 1
  const lastProviderPage = query
    ? Math.min(500, Math.max(5, Math.ceil((start + count) / TMDB_PAGE_SIZE) * 2))
    : Math.ceil((start + count) / TMDB_PAGE_SIZE)
  const pages: Array<TmdbPage<TmdbCatalogRecord>> = []
  let matchingCount = 0

  for (let page = firstProviderPage; page <= lastProviderPage; page += 1) {
    const params = new URLSearchParams({ language: 'en-US', page: String(page), include_adult: 'false' })
    let path: string
    if (query) {
      path = `search/${typePath(type)}`
      params.set('query', query)
    } else {
      path = `discover/${typePath(type)}`
      params.set('sort_by', sortValue(options.sort ?? 'popular', type))
      // TMDB's raw vote average includes perfect scores from one or two votes.
      // Match the useful intent of its top-rated lists while keeping strict
      // numeric descending order within the eligible result set.
      if (options.sort === 'rating') params.set('vote_count.gte', '200')
      const genreId = options.genre ? discoverGenreIds[options.genre]?.[type] : undefined
      if (genreId) params.set('with_genres', String(genreId))
      if (options.year) params.set(type === 'movie' ? 'primary_release_year' : 'first_air_date_year', String(options.year))
    }
    const response = await tmdbFetch<TmdbPage<TmdbCatalogRecord>>(path, params, signal)
    pages.push(response)
    if (query) {
      matchingCount = pages.flatMap((candidatePage) => candidatePage.results)
        .map((record) => normalizeTmdbRecord(record, type))
        .filter((item) => (!options.genre || item.genres.includes(options.genre) || item.genres.some((genre) => genre.includes(options.genre!))) && (!options.year || item.year === options.year))
        .length
    }
    if (query && matchingCount >= start + count) break
    if (page >= Math.min(response.total_pages, 500)) break
  }

  const raw = pages.flatMap((page) => page.results.map((record, index) => normalizeTmdbRecord(record, type, (page.page - 1) * TMDB_PAGE_SIZE + index + 1)))
  const filtered = raw.filter((item) => {
    const matchesGenre = !options.genre || item.genres.includes(options.genre) || item.genres.some((genre) => genre.includes(options.genre!))
    const matchesYear = !options.year || item.year === options.year
    const matchesQuery = !query || item.title.toLowerCase().includes(query.toLowerCase())
    return matchesGenre && matchesYear && matchesQuery
  })
  const total = Math.min(pages[0]?.total_results ?? 0, 10_000)
  const relativeStart = query ? start : start - (firstProviderPage - 1) * TMDB_PAGE_SIZE
  return {
    items: localOrder(filtered, options.sort ?? 'popular', query).slice(relativeStart, relativeStart + count),
    hasNext: query ? matchingCount > start + count || pages.length < Math.min(pages[0]?.total_pages ?? 0, 500) : start + count < total,
    fetched: raw.length,
  }
}

export async function browseTmdbCatalog(options: BrowseCatalogOptions, signal?: AbortSignal): Promise<CatalogPage> {
  const supported = options.types.filter((type): type is 'movie' | 'show' => type === 'movie' || type === 'show')
  if (!supported.length) return { items: [], hasNext: false, fetchedCount: 0, source: 'TMDB' }
  const safePage = Math.max(1, options.page)
  const perType = Math.ceil(options.pageSize / supported.length)
  const start = (safePage - 1) * perType
  const results = await Promise.all(supported.map((type) => fetchTypeWindow(type, options, start, perType, signal)))
  const unique = [...new Map(results.flatMap((result) => result.items).map((item) => [item.id, item])).values()]
  const merged = localOrder(unique, options.sort ?? 'popular', options.query?.trim())
  return {
    items: merged.slice(0, options.pageSize),
    hasNext: results.some((result) => result.hasNext),
    fetchedCount: results.reduce((sum, result) => sum + result.fetched, 0),
    source: 'TMDB',
  }
}

export async function fetchTmdbItemDetails(item: MediaItem): Promise<MediaItem> {
  const type = item.type === 'show' ? 'show' : 'movie'
  const params = new URLSearchParams({ language: 'en-US', append_to_response: 'credits,external_ids' })
  const details = await tmdbFetch<TmdbDetails>(`${typePath(type)}/${item.externalId}`, params)
  const year = yearFromDate(type === 'movie' ? details.release_date : details.first_air_date)
  const lastYear = yearFromDate(details.last_air_date)
  const directors = details.credits?.crew?.filter((person) => person.job === 'Director').map((person) => person.name) ?? []
  const creators = type === 'show' ? details.created_by?.map((person) => person.name) ?? [] : directors
  const seasons: Season[] | undefined = type === 'show'
    ? details.seasons?.filter((season) => season.season_number > 0 && season.episode_count > 0).map((season) => ({ number: season.season_number, episodes: season.episode_count, title: season.name }))
    : undefined
  return {
    ...item,
    title: details.title ?? details.name ?? item.title,
    year,
    releaseInfo: year ? (type === 'show' ? `${year}–${details.status === 'Ended' && lastYear ? lastYear : ''}` : String(year)) : item.releaseInfo,
    genres: details.genres?.map((genre) => genre.name) ?? item.genres,
    summary: details.overview?.trim() || item.summary,
    creator: creators.length ? creators.join(', ') : item.creator,
    runtimeMinutes: type === 'movie' ? details.runtime ?? undefined : details.episode_run_time?.[0],
    seasons,
    posterUrl: details.poster_path ? `${POSTER_BASE}${details.poster_path}` : item.posterUrl,
    backdropUrl: details.backdrop_path ? `${BACKDROP_BASE}${details.backdrop_path}` : item.backdropUrl,
  }
}

export function clearTmdbCache(): void {
  responseCache.clear()
}
