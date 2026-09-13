import type { BrowseCatalogOptions, CatalogPage, CatalogSort } from './catalog'
import type { MediaItem } from './domain'

const OPEN_LIBRARY_PROXY = '/api/openlibrary'
const responseCache = new Map<string, unknown>()

interface OpenLibrarySearchDoc {
  key: string
  title: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  subject?: string[]
  ratings_average?: number
  ratings_count?: number
  readinglog_count?: number
}

interface OpenLibrarySearchResponse {
  start: number
  numFound?: number
  num_found?: number
  docs: OpenLibrarySearchDoc[]
}

interface OpenLibraryWork {
  key: string
  title?: string
  description?: string | { value?: string }
  covers?: number[]
  subjects?: string[]
  first_publish_date?: string
}

interface OpenLibraryRatings {
  summary?: { average?: number; count?: number }
}

const canonicalGenres = [
  'Fiction', 'Fantasy', 'Science Fiction', 'Mystery', 'Romance', 'Thriller',
  'Horror', 'Historical Fiction', 'Biography', 'Memoir', 'History', 'Poetry',
  'Young Adult', 'Children', 'Classics', 'Graphic Novels', 'Crime', 'Adventure',
] as const

function extractGenres(subjects: string[] = []): string[] {
  const lowered = subjects.map((subject) => subject.toLowerCase())
  const matches = canonicalGenres.filter((genre) => lowered.some((subject) => subject === genre.toLowerCase() || subject.includes(genre.toLowerCase())))
  return matches.slice(0, 5)
}

function ratingToTenPoint(value?: number): number | null {
  return Number.isFinite(value) && value! > 0 ? Math.round(value! * 20) / 10 : null
}

export function normalizeOpenLibrary(doc: OpenLibrarySearchDoc, rank?: number): MediaItem {
  const workId = doc.key.replace('/works/', '')
  return {
    id: `openlibrary:book:${workId}`,
    externalId: workId,
    title: doc.title.trim().replace(/\s+/g, ' '),
    type: 'book',
    year: doc.first_publish_year ?? null,
    releaseInfo: doc.first_publish_year ? String(doc.first_publish_year) : 'First publication unavailable',
    genres: extractGenres(doc.subject),
    summary: 'Open the book to load its full work description.',
    creator: doc.author_name?.slice(0, 4).join(', ') || 'Author unavailable',
    posterUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg?default=false` : undefined,
    communityRating: ratingToTenPoint(doc.ratings_average),
    provider: 'Open Library',
    providerUrl: `https://openlibrary.org/works/${workId}`,
    catalogRank: rank,
  }
}

async function openLibraryFetch<T>(path: string, params?: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const url = `${OPEN_LIBRARY_PROXY}${path}${params ? `?${params}` : ''}`
  const cached = responseCache.get(url)
  if (cached) return cached as T
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Open Library request failed (${response.status})`)
  const data = await response.json() as T
  responseCache.set(url, data)
  return data
}

function buildQuery(options: BrowseCatalogOptions): string {
  const parts = ['language:eng']
  const query = options.query?.trim()
  if (query) {
    const escapedQuery = query
      .replace(/&&/g, '\\&&')
      .replace(/\|\|/g, '\\||')
      .replace(/([+\-!(){}\[\]^"~*?:\\/])/g, '\\$1')
    parts.unshift(`(${escapedQuery})`)
  }
  if (options.genre) parts.push(`subject:"${options.genre.replace(/"/g, '')}"`)
  if (options.year) parts.push(`first_publish_year:${options.year}`)
  return parts.join(' AND ')
}

function openLibrarySort(sort: CatalogSort, hasQuery: boolean): string | undefined {
  if (sort === 'rating') return 'rating'
  if (sort === 'title-asc' || sort === 'title-desc') return 'title'
  return hasQuery ? undefined : 'readinglog'
}

function localOrder(items: MediaItem[], sort: CatalogSort): MediaItem[] {
  if (sort === 'rating') return items.sort((a, b) => (b.communityRating ?? -1) - (a.communityRating ?? -1) || a.title.localeCompare(b.title))
  if (sort === 'title-asc' || sort === 'title-desc') {
    const direction = sort === 'title-asc' ? 1 : -1
    return items.sort((a, b) => a.title.localeCompare(b.title) * direction)
  }
  return items
}

export async function browseOpenLibraryCatalog(options: BrowseCatalogOptions, signal?: AbortSignal): Promise<CatalogPage> {
  const page = Math.max(1, options.page)
  const pageSize = Math.max(1, Math.min(100, options.pageSize))
  const params = new URLSearchParams({
    q: buildQuery(options),
    page: String(page),
    limit: String(pageSize),
    fields: 'key,title,author_name,first_publish_year,cover_i,subject,ratings_average,ratings_count,readinglog_count',
  })
  const sort = openLibrarySort(options.sort ?? 'popular', Boolean(options.query?.trim()))
  if (sort) params.set('sort', sort)
  const response = await openLibraryFetch<OpenLibrarySearchResponse>('/search.json', params, signal)
  const total = response.numFound ?? response.num_found ?? 0
  const items = localOrder(response.docs.map((doc, index) => normalizeOpenLibrary(doc, (page - 1) * pageSize + index + 1)), options.sort ?? 'popular')
  return {
    items,
    hasNext: page * pageSize < total,
    fetchedCount: response.docs.length,
    source: 'Open Library',
  }
}

export async function fetchOpenLibraryDetails(item: MediaItem): Promise<MediaItem> {
  const [work, ratings] = await Promise.all([
    openLibraryFetch<OpenLibraryWork>(`/works/${item.externalId}.json`),
    openLibraryFetch<OpenLibraryRatings>(`/works/${item.externalId}/ratings.json`).catch(() => null),
  ])
  const description = typeof work.description === 'string' ? work.description : work.description?.value
  const firstYear = Number(work.first_publish_date?.match(/\d{4}/)?.[0])
  const coverId = work.covers?.find((value) => value > 0)
  return {
    ...item,
    title: work.title ?? item.title,
    year: Number.isInteger(firstYear) ? firstYear : item.year,
    releaseInfo: Number.isInteger(firstYear) ? String(firstYear) : item.releaseInfo,
    genres: extractGenres(work.subjects).length ? extractGenres(work.subjects) : item.genres,
    summary: description?.trim() || item.summary,
    posterUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false` : item.posterUrl,
    communityRating: ratingToTenPoint(ratings?.summary?.average) ?? item.communityRating,
  }
}

export function clearOpenLibraryCache(): void {
  responseCache.clear()
}
