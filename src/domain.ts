export type View = 'library' | 'groups' | 'stats' | 'profile' | 'about'
export type MediaType = 'movie' | 'show' | 'book' | 'album'
export type LibraryStatus = 'want' | 'in-progress' | 'paused' | 'completed' | 'dropped'
export type ProgressSource = 'manual' | 'episodes'
export type ProfileVisibility = 'private' | 'friends' | 'public'
export type ProfileShowcases = Partial<Record<MediaType, string[]>>
export const MAX_REVIEW_LENGTH = 250

export interface Season { number: number; title: string; episodes: number }

export interface MediaItem {
  id: string
  externalId: string
  title: string
  type: MediaType
  year: number | null
  releaseInfo: string
  genres: string[]
  summary: string
  creator: string
  runtimeMinutes?: number
  seasons?: Season[]
  posterUrl?: string
  backdropUrl?: string
  communityRating: number | null
  provider: 'Cinemeta' | 'TMDB' | 'Open Library' | 'MusicBrainz'
  providerUrl: string
  catalogRank?: number
}

export interface Profile {
  id: string
  name: string
  handle: string
  initials: string
  color: string
  avatar?: string
  visibility?: ProfileVisibility
  showcaseItemIds?: ProfileShowcases
  nextUpItemIds?: ProfileShowcases
}

export interface LibraryEntry {
  userId: string
  itemId: string
  status: LibraryStatus
  progress: number
  progressSource: ProgressSource
  watchedEpisodes: number[]
  rating: number | null
  completionCount: number
  favorite: boolean
  priority: boolean
  review: string
  completedAt: string | null
  updatedAt: string
}

export type ActivityAction = 'saved' | 'started' | 'progressed' | 'paused' | 'completed' | 'dropped' | 'rewatched' | 'rated'

export interface ActivityEvent {
  id: string
  userId: string
  itemId: string
  action: ActivityAction
  detail: string
  createdAt: string
}

export interface ShelfState {
  currentUserId: string
  items: MediaItem[]
  entries: LibraryEntry[]
  activities: ActivityEvent[]
}

export interface GroupMetric {
  item: MediaItem
  completed: number
  wanted: number
  active: number
  dropped: number
  rated: number
  averageRating: number | null
}

export interface UserStats {
  completed: number
  episodes: number
  minutes: number
  dropped: number
  rewatches: number
  averageRating: number | null
  topGenre: string
  rated: number
}

export const statusLabels: Record<LibraryStatus, string> = {
  want: 'Want to start',
  'in-progress': 'In progress',
  paused: 'Paused',
  completed: 'Completed',
  dropped: 'Dropped',
}

export function getStatusLabel(status: LibraryStatus, type: MediaType): string {
  const labels: Record<MediaType, Record<LibraryStatus, string>> = {
    movie: { want: 'Want to watch', 'in-progress': 'Watching', paused: 'Paused', completed: 'Watched', dropped: 'Stopped watching' },
    show: { want: 'Want to watch', 'in-progress': 'Watching', paused: 'Paused', completed: 'Watched', dropped: 'Stopped watching' },
    book: { want: 'Want to read', 'in-progress': 'Reading', paused: 'Paused', completed: 'Read', dropped: 'Did not finish' },
    album: { want: 'Want to listen', 'in-progress': 'Listening', paused: 'Paused', completed: 'Listened', dropped: 'Stopped listening' },
  }
  return labels[type][status]
}

export const mediaTypeLabels: Record<MediaType, string> = {
  movie: 'Movie',
  show: 'TV show',
  book: 'Book',
  album: 'Album',
}

export function totalEpisodes(item: MediaItem): number {
  return item.seasons?.reduce((sum, season) => sum + season.episodes, 0) ?? 0
}

export function getEntry(entries: LibraryEntry[], userId: string, itemId: string): LibraryEntry | undefined {
  return entries.find((entry) => entry.userId === userId && entry.itemId === itemId)
}

export function getProgressLabel(item: MediaItem, entry?: LibraryEntry): string {
  if (!entry) return 'Not added'
  if (entry.status === 'want') return 'Not started'
  if (entry.status === 'completed') {
    if (entry.completionCount > 1) {
      if (item.type === 'book') return `${entry.completionCount} reads`
      if (item.type === 'album') return `${entry.completionCount} listens`
      return `${entry.completionCount} completions`
    }
    if (item.type === 'book') return 'Read'
    if (item.type === 'album') return 'Listened'
    return 'Complete'
  }
  if (item.type === 'show' && entry.progressSource === 'episodes' && totalEpisodes(item)) {
    return `${entry.watchedEpisodes.length} / ${totalEpisodes(item)} eps`
  }
  return `${entry.progress}%`
}

export function getGroupMetrics(catalog: MediaItem[], entries: LibraryEntry[], memberIds: string[]): GroupMetric[] {
  return catalog.map((item) => {
    const itemEntries = entries.filter((entry) => memberIds.includes(entry.userId) && entry.itemId === item.id)
    const ratings = itemEntries.map((entry) => entry.rating).filter((rating): rating is number => rating !== null)
    return {
      item,
      completed: itemEntries.filter((entry) => entry.completionCount > 0).length,
      wanted: itemEntries.filter((entry) => entry.status === 'want').length,
      active: itemEntries.filter((entry) => ['in-progress', 'paused'].includes(entry.status)).length,
      dropped: itemEntries.filter((entry) => entry.status === 'dropped').length,
      rated: ratings.length,
      averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
    }
  }).filter((metric) => metric.completed + metric.wanted + metric.active + metric.dropped > 0)
}

export function getUserStats(
  catalog: MediaItem[],
  entries: LibraryEntry[],
  userId: string,
  options: { type?: MediaType | 'all'; year?: number | null } = {},
): UserStats {
  const userEntries = entries.filter((entry) => {
    if (entry.userId !== userId) return false
    const item = catalog.find((candidate) => candidate.id === entry.itemId)
    if (options.type && options.type !== 'all' && item?.type !== options.type) return false
    if (options.year && new Date(entry.completedAt ?? entry.updatedAt).getFullYear() !== options.year) return false
    return true
  })
  const completed = userEntries.filter((entry) => entry.completionCount > 0)
  const ratings = userEntries.map((entry) => entry.rating).filter((rating): rating is number => rating !== null)
  const genres = new Map<string, number>()
  completed.forEach((entry) => catalog.find((item) => item.id === entry.itemId)?.genres.forEach((genre) => {
    genres.set(genre, (genres.get(genre) ?? 0) + 1)
  }))
  const topGenre = [...genres.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
  return {
    completed: completed.length,
    episodes: userEntries.reduce((sum, entry) => sum + entry.watchedEpisodes.length, 0),
    minutes: userEntries.reduce((sum, entry) => {
      const item = catalog.find((candidate) => candidate.id === entry.itemId)
      if (!item) return sum
      if (item.type === 'movie') {
        const done = (item.runtimeMinutes ?? 0) * entry.completionCount
        const partial = entry.status === 'completed' ? 0 : Math.round(((item.runtimeMinutes ?? 0) * entry.progress) / 100)
        return sum + done + partial
      }
      return sum + entry.watchedEpisodes.length * (item.runtimeMinutes ?? 46)
    }, 0),
    dropped: userEntries.filter((entry) => entry.status === 'dropped').length,
    rewatches: completed.reduce((sum, entry) => sum + Math.max(0, entry.completionCount - 1), 0),
    averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
    topGenre,
    rated: ratings.length,
  }
}

export function seasonEpisodeRange(item: MediaItem, seasonNumber: number): number[] {
  if (!item.seasons) return []
  const seasonIndex = item.seasons.findIndex((season) => season.number === seasonNumber)
  if (seasonIndex < 0) return []
  const start = item.seasons.slice(0, seasonIndex).reduce((sum, season) => sum + season.episodes, 0)
  return Array.from({ length: item.seasons[seasonIndex].episodes }, (_, index) => start + index + 1)
}

export function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function normalizeReview(value: string): string {
  const plainText = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  return Array.from(plainText).slice(0, MAX_REVIEW_LENGTH).join('')
}

export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}
