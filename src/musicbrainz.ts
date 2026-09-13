import type { BrowseCatalogOptions, CatalogPage, CatalogSort } from './catalog'
import type { MediaItem } from './domain'

const MUSICBRAINZ_PROXY = '/api/musicbrainz'
const LISTENBRAINZ_PROXY = '/api/listenbrainz'
const POPULARITY_LIMIT = 1_000
const responseCache = new Map<string, unknown>()

interface ArtistCredit {
  name?: string
  joinphrase?: string
  artist?: { name?: string }
}

interface MusicBrainzReleaseGroup {
  id: string
  title: string
  score?: number
  'first-release-date'?: string
  'primary-type'?: string
  'secondary-types'?: string[]
  'artist-credit'?: ArtistCredit[]
  genres?: Array<{ name: string; count?: number }>
  tags?: Array<{ name: string; count?: number }>
  rating?: { value?: number; 'votes-count'?: number }
  releases?: Array<{ id: string; title?: string; status?: string; date?: string }>
}

interface MusicBrainzSearchResponse {
  count: number
  offset: number
  'release-groups': MusicBrainzReleaseGroup[]
}

interface ListenBrainzReleaseGroup {
  artist_name?: string
  caa_id?: number | null
  caa_release_mbid?: string | null
  listen_count: number
  release_group_mbid?: string | null
  release_group_name: string
}

interface ListenBrainzStatsResponse {
  payload: {
    count: number
    offset: number
    total_release_group_count: number
    release_groups: ListenBrainzReleaseGroup[]
  }
}

interface ListenBrainzMetadataEntry {
  artist?: { name?: string }
  release_group?: {
    caa_id?: number | null
    caa_release_mbid?: string | null
    date?: string
    name?: string
    type?: string
  }
  tag?: {
    release_group?: Array<{ count?: number; genre_mbid?: string; tag: string }>
  }
}

type ListenBrainzMetadataResponse = Record<string, ListenBrainzMetadataEntry>

function coverUrl(releaseGroupMbid: string, size: 250 | 500): string {
  return `https://coverartarchive.org/release-group/${releaseGroupMbid}/front-${size}`
}

function parseYear(value?: string): number | null {
  const year = Number(value?.match(/\d{4}/)?.[0])
  return Number.isInteger(year) ? year : null
}

function artistName(credits: ArtistCredit[] = []): string {
  const joined = credits.map((credit) => `${credit.name ?? credit.artist?.name ?? ''}${credit.joinphrase ?? ''}`).join('').trim()
  return joined || 'Artist unavailable'
}

const genreLabels = new Map([
  ['r&b', 'R&B'], ['rhythm and blues', 'R&B'], ['hip hop', 'Hip Hop'], ['hip-hop', 'Hip Hop'],
  ['edm', 'Electronic'], ['electronica', 'Electronic'], ['alt rock', 'Alternative Rock'],
])

function genreLabel(value: string): string {
  const lowered = value.trim().toLowerCase()
  return genreLabels.get(lowered) ?? lowered.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function genresFromTags(tags: Array<{ count?: number; genre_mbid?: string; tag?: string; name?: string }> = []): string[] {
  return tags
    .filter((tag) => Boolean(tag.genre_mbid) || tags.every((candidate) => !candidate.genre_mbid))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .map((tag) => genreLabel(tag.tag ?? tag.name ?? ''))
    .filter(Boolean)
    .filter((genre, index, values) => values.indexOf(genre) === index)
    .slice(0, 5)
}

function ratingToTenPoint(rating?: { value?: number }): number | null {
  const value = rating?.value
  return Number.isFinite(value) && value! > 0 ? Math.round(value! * 20) / 10 : null
}

function escapeLucene(value: string): string {
  return value
    .replace(/&&/g, '\\&&')
    .replace(/\|\|/g, '\\||')
    .replace(/([+\-!(){}\[\]^"~*?:\\/])/g, '\\$1')
}

async function cachedFetch<T>(url: string, signal?: AbortSignal): Promise<T> {
  const cached = responseCache.get(url)
  if (cached) return cached as T
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { signal })
    if (response.ok) {
      const data = await response.json() as T
      responseCache.set(url, data)
      return data
    }
    const retryable = response.status === 429 || response.status >= 500
    if (!retryable || attempt === 2) throw new Error(`Music catalog request failed (${response.status})`)
    await new Promise((resolve) => setTimeout(resolve, 350 * (2 ** attempt)))
    if (signal?.aborted) throw new DOMException('Catalog request aborted', 'AbortError')
  }
  throw new Error('Music catalog request failed')
}

export function normalizeMusicBrainzSearch(group: MusicBrainzReleaseGroup, rank?: number): MediaItem {
  const year = parseYear(group['first-release-date'])
  return {
    id: `musicbrainz:album:${group.id}`,
    externalId: group.id,
    title: group.title.trim().replace(/\s+/g, ' '),
    type: 'album',
    year,
    releaseInfo: group['first-release-date'] || 'Release date unavailable',
    genres: genresFromTags(group.genres?.length ? group.genres : group.tags),
    summary: 'Open the album to load its MusicBrainz release-group details.',
    creator: artistName(group['artist-credit']),
    posterUrl: coverUrl(group.id, 250),
    communityRating: ratingToTenPoint(group.rating),
    provider: 'MusicBrainz',
    providerUrl: `https://musicbrainz.org/release-group/${group.id}`,
    catalogRank: rank,
  }
}

export function normalizeListenBrainz(
  group: ListenBrainzReleaseGroup,
  metadata: ListenBrainzMetadataEntry = {},
  rank?: number,
): MediaItem | null {
  const id = group.release_group_mbid
  if (!id || (metadata.release_group?.type && metadata.release_group.type !== 'Album')) return null
  const year = parseYear(metadata.release_group?.date)
  return {
    id: `musicbrainz:album:${id}`,
    externalId: id,
    title: (metadata.release_group?.name || group.release_group_name).trim().replace(/\s+/g, ' '),
    type: 'album',
    year,
    releaseInfo: metadata.release_group?.date || 'Release date unavailable',
    genres: genresFromTags(metadata.tag?.release_group),
    summary: `${group.listen_count.toLocaleString()} listens recorded by the ListenBrainz community. Open the album for complete metadata.`,
    creator: metadata.artist?.name || group.artist_name || 'Artist unavailable',
    posterUrl: coverUrl(id, 250),
    communityRating: null,
    provider: 'MusicBrainz',
    providerUrl: `https://musicbrainz.org/release-group/${id}`,
    catalogRank: rank,
  }
}

async function fetchPopularChunk(offset: number, signal?: AbortSignal): Promise<{ items: MediaItem[]; rawCount: number; total: number }> {
  const statsParams = new URLSearchParams({ range: 'all_time', count: '100', offset: String(offset) })
  const stats = await cachedFetch<ListenBrainzStatsResponse>(`${LISTENBRAINZ_PROXY}/1/stats/sitewide/release-groups?${statsParams}`, signal)
  const raw = [...new Map(stats.payload.release_groups
    .filter((group) => group.release_group_mbid)
    .map((group) => [group.release_group_mbid!, group])).values()]
  const ids = raw.map((group) => group.release_group_mbid!)
  // Keep each GET comfortably below common proxy URL limits. ListenBrainz's
  // release-group metadata endpoint documents a comma-separated GET parameter.
  const metadataResponses = await Promise.all(Array.from({ length: Math.ceil(ids.length / 40) }, (_, index) => {
    const batch = ids.slice(index * 40, (index + 1) * 40)
    const metadataParams = new URLSearchParams({ release_group_mbids: batch.join(','), inc: 'artist tag release' })
    return cachedFetch<ListenBrainzMetadataResponse>(`${LISTENBRAINZ_PROXY}/1/metadata/release_group/?${metadataParams}`, signal)
  }))
  const metadata = Object.assign({}, ...metadataResponses) as ListenBrainzMetadataResponse
  const items = raw
    .map((group, index) => normalizeListenBrainz(group, metadata[group.release_group_mbid!], offset + index + 1))
    .filter((item): item is MediaItem => Boolean(item))
  return { items, rawCount: stats.payload.count, total: stats.payload.total_release_group_count }
}

async function browsePopular(options: BrowseCatalogOptions, signal?: AbortSignal): Promise<CatalogPage> {
  const page = Math.max(1, options.page)
  const pageSize = Math.max(1, Math.min(100, options.pageSize))
  const start = (page - 1) * pageSize
  const end = page * pageSize
  const albums = new Map<string, MediaItem>()
  let rawOffset = 0
  let total = POPULARITY_LIMIT
  while (albums.size < end && rawOffset < Math.min(total, POPULARITY_LIMIT)) {
    const chunk = await fetchPopularChunk(rawOffset, signal)
    chunk.items.forEach((item) => { if (!albums.has(item.id)) albums.set(item.id, item) })
    rawOffset += chunk.rawCount
    total = chunk.total
    if (!chunk.rawCount) break
  }
  return {
    items: [...albums.values()].slice(start, end).map((item, index) => ({ ...item, catalogRank: start + index + 1 })),
    hasNext: albums.size > end || rawOffset < Math.min(total, POPULARITY_LIMIT),
    fetchedCount: rawOffset,
    source: 'MusicBrainz',
  }
}

function buildSearchQuery(options: BrowseCatalogOptions): string {
  const parts = ['primarytype:album']
  const query = options.query?.trim()
  if (query) {
    const escaped = escapeLucene(query)
    parts.unshift(`(releasegroup:(${escaped}) OR artist:(${escaped}))`)
  }
  if (options.genre) parts.push(`tag:"${escapeLucene(options.genre.toLowerCase())}"`)
  if (options.year) parts.push(`firstreleasedate:[${options.year}-01-01 TO ${options.year}-12-31]`)
  return parts.join(' AND ')
}

function localOrder(items: MediaItem[], sort: CatalogSort): MediaItem[] {
  if (sort === 'title-asc' || sort === 'title-desc') {
    const direction = sort === 'title-asc' ? 1 : -1
    return items.sort((a, b) => a.title.localeCompare(b.title) * direction)
  }
  return items
}

async function browseSearch(options: BrowseCatalogOptions, signal?: AbortSignal): Promise<CatalogPage> {
  const page = Math.max(1, options.page)
  const pageSize = Math.max(1, Math.min(100, options.pageSize))
  const offset = (page - 1) * pageSize
  const params = new URLSearchParams({
    query: buildSearchQuery(options),
    fmt: 'json',
    limit: String(pageSize),
    offset: String(offset),
  })
  const response = await cachedFetch<MusicBrainzSearchResponse>(`${MUSICBRAINZ_PROXY}/ws/2/release-group/?${params}`, signal)
  const items = localOrder(response['release-groups'].map((group, index) => {
    const item = normalizeMusicBrainzSearch(group, offset + index + 1)
    if (options.genre && !item.genres.some((genre) => genre.toLowerCase() === options.genre!.toLowerCase())) {
      item.genres = [options.genre, ...item.genres].slice(0, 5)
    }
    return item
  }), options.sort ?? 'popular')
  return {
    items,
    hasNext: offset + response['release-groups'].length < response.count,
    fetchedCount: response['release-groups'].length,
    source: 'MusicBrainz',
  }
}

export async function browseMusicCatalog(options: BrowseCatalogOptions, signal?: AbortSignal): Promise<CatalogPage> {
  const usesPopularLanding = !options.query?.trim() && !options.genre && !options.year && (options.sort === undefined || options.sort === 'popular' || options.sort === 'rating')
  return usesPopularLanding ? browsePopular(options, signal) : browseSearch(options, signal)
}

export async function fetchMusicDetails(item: MediaItem): Promise<MediaItem> {
  const params = new URLSearchParams({ fmt: 'json', inc: 'ratings genres artist-credits releases tags' })
  const group = await cachedFetch<MusicBrainzReleaseGroup>(`${MUSICBRAINZ_PROXY}/ws/2/release-group/${item.externalId}?${params}`)
  const normalized = normalizeMusicBrainzSearch(group, item.catalogRank)
  const releaseCount = group.releases?.length ?? 0
  const type = [group['primary-type'], ...(group['secondary-types'] ?? [])].filter(Boolean).join(' · ').toLowerCase() || 'release group'
  const article = /^[aeiou]/i.test(type) ? 'an' : 'a'
  return {
    ...item,
    ...normalized,
    posterUrl: coverUrl(item.externalId, 500),
    summary: `${normalized.title} is ${article} ${type} by ${normalized.creator}, first released ${normalized.releaseInfo}.${releaseCount ? ` MusicBrainz currently links ${releaseCount} release ${releaseCount === 1 ? 'edition' : 'editions'} to this album.` : ''}`,
  }
}

export function clearMusicCatalogCache(): void {
  responseCache.clear()
}
