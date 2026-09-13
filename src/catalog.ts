import type { MediaItem, MediaType, Season } from './domain'
import { browseMusicCatalog, clearMusicCatalogCache, fetchMusicDetails } from './musicbrainz'
import { browseOpenLibraryCatalog, clearOpenLibraryCache, fetchOpenLibraryDetails } from './openlibrary'
import { browseTmdbCatalog, clearTmdbCache, fetchTmdbItemDetails } from './tmdb'

const CINEMETA_BASE = 'https://v3-cinemeta.strem.io'
const CINEMETA_CATALOG_ORIGIN = 'https://cinemeta-catalogs.strem.io'
const PAGE_SIZE = 50
const catalogPageCache = new Map<string, MediaItem[]>()
let providerRequestQueue: Promise<unknown> = Promise.resolve()

export const CATALOG_GENRES = [
  'Action', 'Adventure', 'Animation', 'Biography', 'Children', 'Classics',
  'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'Fiction',
  'Graphic Novels', 'Historical Fiction', 'History', 'Horror', 'Kids', 'Memoir',
  'Music', 'Mystery', 'News', 'Poetry', 'Reality', 'Romance', 'Science Fiction',
  'Soap', 'Talk', 'Thriller', 'TV Movie', 'War', 'Western', 'Young Adult',
  'Alternative', 'Alternative Rock', 'Blues', 'Classical', 'Country', 'Dance',
  'Electronic', 'Folk', 'Hip Hop', 'Jazz', 'Latin', 'Metal', 'Pop', 'Punk',
  'R&B', 'Reggae', 'Rock', 'Soul', 'Soundtrack', 'World',
] as const

export type CatalogSort = 'popular' | 'rating' | 'title-asc' | 'title-desc'

export interface BrowseCatalogOptions {
  page: number
  pageSize: number
  types: MediaType[]
  query?: string
  genre?: string
  year?: number | null
  sort?: CatalogSort
}

export interface CatalogPage {
  items: MediaItem[]
  hasNext: boolean
  fetchedCount: number
  source: 'TMDB' | 'Cinemeta' | 'Open Library' | 'MusicBrainz' | 'Mixed'
}

interface CinemetaVideo { season?: number; episode?: number; released?: string }

interface CinemetaMeta {
  id: string
  imdb_id?: string
  type: 'movie' | 'series'
  name: string
  poster?: string
  background?: string
  releaseInfo?: string
  year?: string
  genres?: string[]
  genre?: string[]
  description?: string
  director?: string[] | null
  writer?: string[] | null
  cast?: string[]
  runtime?: string
  imdbRating?: string
  videos?: CinemetaVideo[]
}

interface CatalogResponse { metas?: CinemetaMeta[] }
interface MetaResponse { meta?: CinemetaMeta }

function parseYear(value?: string): number | null {
  const match = value?.match(/\d{4}/)
  return match ? Number(match[0]) : null
}

function parseRuntime(value?: string): number | undefined {
  const match = value?.match(/\d+/)
  return match ? Number(match[0]) : undefined
}

function buildSeasons(videos?: CinemetaVideo[]): Season[] | undefined {
  if (!videos?.length) return undefined
  const counts = new Map<number, number>()
  videos.filter((video) => {
    if (!video.season || video.season < 1 || !video.episode) return false
    return !video.released || new Date(video.released).getTime() <= Date.now()
  }).forEach((video) => counts.set(video.season!, (counts.get(video.season!) ?? 0) + 1))
  const seasons = [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, episodes]) => ({ number, episodes, title: `${episodes} episodes` }))
  return seasons.length ? seasons : undefined
}

export function normalizeCinemeta(meta: CinemetaMeta, rank?: number): MediaItem {
  const type: MediaType = meta.type === 'series' ? 'show' : 'movie'
  const externalId = meta.imdb_id ?? meta.id
  const creators = type === 'movie' ? meta.director : meta.writer
  const rating = meta.imdbRating?.trim()
  return {
    id: `cinemeta:${type}:${externalId}`,
    externalId,
    title: meta.name,
    type,
    year: parseYear(meta.year ?? meta.releaseInfo),
    releaseInfo: meta.releaseInfo ?? meta.year ?? 'Release year unavailable',
    genres: meta.genres ?? meta.genre ?? [],
    summary: meta.description ?? 'Open the title to load full metadata.',
    creator: creators?.length
      ? creators.join(', ')
      : meta.cast?.length
        ? meta.cast.slice(0, 3).join(', ')
        : 'Credits unavailable',
    runtimeMinutes: parseRuntime(meta.runtime),
    seasons: buildSeasons(meta.videos),
    posterUrl: meta.poster,
    backdropUrl: meta.background,
    communityRating: rating && Number.isFinite(Number(rating)) ? Number(rating) : null,
    provider: 'Cinemeta',
    providerUrl: `https://www.imdb.com/title/${externalId}/`,
    catalogRank: rank,
  }
}

async function fetchJson<T>(url: string, signal?: AbortSignal, notFoundValue?: T): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const responsePromise = providerRequestQueue.then(() => {
      if (signal?.aborted) throw new DOMException('Catalog request aborted', 'AbortError')
      return fetch(url, { signal })
    })
    providerRequestQueue = responsePromise.then(() => undefined, () => undefined)
    const response = await responsePromise
    if (response.ok) return response.json() as Promise<T>
    if (response.status === 404 && notFoundValue !== undefined) return notFoundValue
    const retryable = response.status === 429 || response.status >= 500
    if (!retryable || attempt === 2) throw new Error(`Catalog request failed (${response.status})`)
    await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)))
    if (signal?.aborted) throw new DOMException('Catalog request aborted', 'AbortError')
  }
  throw new Error('Catalog request failed')
}

async function fetchCatalogPage(
  type: 'movie' | 'series',
  catalogId: 'top' | 'year' | 'imdbRating',
  skip: number,
  primaryExtra?: { name: 'genre' | 'search'; value: string },
  signal?: AbortSignal,
): Promise<MediaItem[]> {
  const extras = [primaryExtra && `${primaryExtra.name}=${encodeURIComponent(primaryExtra.value)}`, `skip=${skip}`].filter(Boolean).join('&')
  const url = `${CINEMETA_CATALOG_ORIGIN}/${catalogId}/catalog/${type}/${catalogId}/${extras}.json`
  const cached = catalogPageCache.get(url)
  if (cached) return cached
  const data = await fetchJson<CatalogResponse>(
    url,
    signal,
    { metas: [] },
  )
  const items = (data.metas ?? []).map((item, index) => normalizeCinemeta(item, skip + index + 1))
  catalogPageCache.set(url, items)
  return items
}

export function clearCatalogCache(): void {
  catalogPageCache.clear()
  providerRequestQueue = Promise.resolve()
  clearTmdbCache()
  clearOpenLibraryCache()
  clearMusicCatalogCache()
}

export async function browseCinemetaCatalog(options: BrowseCatalogOptions, signal?: AbortSignal): Promise<CatalogPage> {
  const supported = options.types.filter((type): type is 'movie' | 'show' => type === 'movie' || type === 'show')
  if (!supported.length) return { items: [], hasNext: false, fetchedCount: 0, source: 'Cinemeta' }

  const targetPerType = Math.ceil(options.pageSize / supported.length / PAGE_SIZE) * PAGE_SIZE
  const safePage = Math.max(1, options.page)
  const trimmedQuery = options.query?.trim()
  const catalogId: 'top' | 'year' | 'imdbRating' = trimmedQuery
    ? 'top'
    : options.year
      ? 'year'
      : 'top'
  const primaryExtra = trimmedQuery
    ? { name: 'search' as const, value: trimmedQuery }
    : options.year
      ? { name: 'genre' as const, value: String(options.year) }
      : options.genre
        ? { name: 'genre' as const, value: options.genre }
        : undefined

  const query = trimmedQuery?.toLowerCase()
  const matches = (item: MediaItem) => {
    const matchesGenre = !options.genre || item.genres.includes(options.genre)
    const matchesYear = !options.year || item.year === options.year
    const matchesQuery = !query || item.title.toLowerCase().includes(query)
    return matchesGenre && matchesYear && matchesQuery
  }
  const order = (items: MediaItem[]) => {
    if (options.sort === 'rating') return items.sort((a, b) => {
      if (a.communityRating === null && b.communityRating === null) return a.title.localeCompare(b.title)
      if (a.communityRating === null) return 1
      if (b.communityRating === null) return -1
      return b.communityRating - a.communityRating || a.title.localeCompare(b.title)
    })
    if (options.sort === 'title-asc' || options.sort === 'title-desc') {
      const direction = options.sort === 'title-asc' ? 1 : -1
      return items.sort((a, b) => a.title.localeCompare(b.title) * direction)
    }
    if (query) return items.sort((a, b) => {
      const score = (title: string) => title === query ? 0 : title.startsWith(query) ? 1 : 2
      return score(a.title.toLowerCase()) - score(b.title.toLowerCase()) || (b.communityRating ?? 0) - (a.communityRating ?? 0)
    })
    return items
  }

  // Rating is a local numeric sort over the same popular catalog users were
  // already browsing. Cinemeta's separate rating feed is not reliably ordered.
  if (options.sort === 'rating') {
    const globalStart = (safePage - 1) * options.pageSize
    const globalEnd = safePage * options.pageSize
    const minimumBatches = Math.ceil((globalEnd + 1) / supported.length / PAGE_SIZE)
    const batchesPerType = Math.min(40, Math.max(10, minimumBatches))
    const typeScans = await Promise.all(supported.map(async (type) => {
      const providerType = type === 'show' ? 'series' : 'movie'
      const batches: MediaItem[][] = []
      for (let batch = 0; batch < batchesPerType; batch += 1) {
        batches.push(await fetchCatalogPage(providerType, catalogId, batch * PAGE_SIZE, primaryExtra, signal))
        if (batches.at(-1)?.length === 0) break
      }
      return batches
    }))
    const batches = typeScans.flat()
    const raw = [...new Map(batches.flat().map((item) => [item.id, item])).values()]
    const filtered = order(raw.filter(matches))
    return {
      items: filtered.slice(globalStart, globalEnd),
      hasNext: filtered.length > globalEnd || typeScans.some((batchesForType) => batchesForType.at(-1)?.length !== 0),
      fetchedCount: raw.length,
      source: 'Cinemeta',
    }
  }

  const hasComposableFilters = Boolean(trimmedQuery || options.genre || options.year)
  if (hasComposableFilters) {
    const filteredStart = (safePage - 1) * targetPerType
    const filteredEnd = safePage * targetPerType
    const typeResults = await Promise.all(supported.map(async (type) => {
      const providerType = type === 'show' ? 'series' : 'movie'
      const unique = new Map<string, MediaItem>()
      let filtered: MediaItem[] = []
      let lastBatchLength = PAGE_SIZE
      let batch = 0
      while (batch < 40 && filtered.length <= filteredEnd && lastBatchLength > 0) {
        const pageItems = await fetchCatalogPage(providerType, catalogId, batch * PAGE_SIZE, primaryExtra, signal)
        lastBatchLength = pageItems.length
        pageItems.forEach((item) => unique.set(item.id, item))
        filtered = [...unique.values()].filter(matches)
        batch += 1
      }
      return {
        rawCount: unique.size,
        items: filtered.slice(filteredStart, filteredEnd),
        hasNext: filtered.length > filteredEnd || (lastBatchLength > 0 && batch < 40),
      }
    }))
    return {
      items: order(typeResults.flatMap((result) => result.items)).slice(0, options.pageSize),
      hasNext: typeResults.some((result) => result.hasNext),
      fetchedCount: typeResults.reduce((sum, result) => sum + result.rawCount, 0),
      source: 'Cinemeta',
    }
  }

  const batchesPerType = targetPerType / PAGE_SIZE
  const baseSkip = (safePage - 1) * targetPerType
  const batches = await Promise.all(supported.flatMap((type) => {
    const providerType = type === 'show' ? 'series' : 'movie'
    return Array.from({ length: batchesPerType }, (_, batch) =>
      fetchCatalogPage(providerType, catalogId, baseSkip + batch * PAGE_SIZE, primaryExtra, signal))
  }))
  const raw = [...new Map(batches.flat().map((item) => [item.id, item])).values()]
  const items = order(raw.filter(matches))
  return {
    items: items.slice(0, options.pageSize),
    hasNext: batches.some((batch) => batch.length > 0),
    fetchedCount: raw.length,
    source: 'Cinemeta',
  }
}

async function browseScreenCatalog(options: BrowseCatalogOptions, signal?: AbortSignal): Promise<CatalogPage> {
  try {
    return await browseTmdbCatalog(options, signal)
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    return browseCinemetaCatalog(options, signal)
  }
}

function orderMixedCatalog(items: MediaItem[], sort: CatalogSort = 'popular'): MediaItem[] {
  if (sort === 'rating') return items.sort((a, b) => (b.communityRating ?? -1) - (a.communityRating ?? -1) || a.title.localeCompare(b.title))
  if (sort === 'title-asc' || sort === 'title-desc') {
    const direction = sort === 'title-asc' ? 1 : -1
    return items.sort((a, b) => a.title.localeCompare(b.title) * direction)
  }
  return items.sort((a, b) => (a.catalogRank ?? Number.MAX_SAFE_INTEGER) - (b.catalogRank ?? Number.MAX_SAFE_INTEGER))
}

export async function browseCatalog(options: BrowseCatalogOptions, signal?: AbortSignal): Promise<CatalogPage> {
  const screenTypes = options.types.filter((type): type is 'movie' | 'show' => type === 'movie' || type === 'show')
  const includesBooks = options.types.includes('book')
  const includesAlbums = options.types.includes('album')
  const selectedTypeCount = screenTypes.length + (includesBooks ? 1 : 0) + (includesAlbums ? 1 : 0)
  if (!selectedTypeCount) return { items: [], hasNext: false, fetchedCount: 0, source: 'Mixed' }
  const perType = Math.ceil(options.pageSize / selectedTypeCount)
  const requests: Array<Promise<CatalogPage>> = []
  if (screenTypes.length) requests.push(browseScreenCatalog({ ...options, types: screenTypes, pageSize: perType * screenTypes.length }, signal))
  if (includesBooks) requests.push(browseOpenLibraryCatalog({ ...options, types: ['book'], pageSize: perType }, signal))
  if (includesAlbums) requests.push(browseMusicCatalog({ ...options, types: ['album'], pageSize: perType }, signal))
  const pages = await Promise.all(requests)
  return {
    items: orderMixedCatalog(pages.flatMap((page) => page.items), options.sort).slice(0, options.pageSize),
    hasNext: pages.some((page) => page.hasNext),
    fetchedCount: pages.reduce((sum, page) => sum + page.fetchedCount, 0),
    source: pages.length === 1 ? pages[0].source : 'Mixed',
  }
}

export async function fetchItemDetails(item: MediaItem): Promise<MediaItem> {
  if (item.provider === 'Open Library') return fetchOpenLibraryDetails(item)
  if (item.provider === 'MusicBrainz') return fetchMusicDetails(item)
  if (item.type !== 'movie' && item.type !== 'show') return item
  if (item.provider === 'TMDB') return fetchTmdbItemDetails(item)
  const providerType = item.type === 'show' ? 'series' : 'movie'
  const data = await fetchJson<MetaResponse>(`${CINEMETA_BASE}/meta/${providerType}/${item.externalId}.json`)
  return data.meta ? { ...item, ...normalizeCinemeta(data.meta), catalogRank: item.catalogRank } : item
}
