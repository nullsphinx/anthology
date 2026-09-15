import type { LibraryEntry, MediaItem, MediaType, ProfileShowcases } from './domain'

export const PROFILE_SHOWCASE_LIMIT = 12

export type ProfileShelf = {
  type: MediaType
  completedCount: number
  queueCount: number
  favoriteCandidates: MediaItem[]
  favorites: MediaItem[]
  priorities: MediaItem[]
  customized: boolean
}

export function normalizeProfileShowcases(value: unknown): ProfileShowcases {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: ProfileShowcases = {}
  for (const type of ['movie', 'show', 'book', 'album'] as const) {
    if (!Object.prototype.hasOwnProperty.call(value, type)) continue
    const candidate = (value as Record<string, unknown>)[type]
    if (!Array.isArray(candidate)) continue
    result[type] = [...new Set(candidate.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 600))].slice(0, PROFILE_SHOWCASE_LIMIT)
  }
  return result
}

export function buildProfileShelf(
  type: MediaType,
  items: MediaItem[],
  entries: LibraryEntry[],
  userId: string,
  showcases: ProfileShowcases = {},
): ProfileShelf {
  const itemById = new Map(items.filter((item) => item.type === type).map((item) => [item.id, item]))
  const typedEntries = entries.filter((entry) => entry.userId === userId && itemById.has(entry.itemId))
  const newestFirst = (left: LibraryEntry, right: LibraryEntry) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  const favoriteEntries = typedEntries.filter((entry) => entry.status === 'completed' && entry.favorite).sort(newestFirst)
  const favoriteCandidates = favoriteEntries.map((entry) => itemById.get(entry.itemId)!).filter(Boolean)
  const configuredIds = showcases[type]
  const favorites = configuredIds
    ? configuredIds.flatMap((id) => {
      const item = itemById.get(id)
      return item && favoriteEntries.some((entry) => entry.itemId === item.id) ? [item] : []
    })
    : favoriteCandidates.slice(0, PROFILE_SHOWCASE_LIMIT)

  return {
    type,
    completedCount: typedEntries.filter((entry) => entry.status === 'completed').length,
    queueCount: typedEntries.filter((entry) => entry.status === 'want').length,
    favoriteCandidates,
    favorites,
    priorities: typedEntries
      .filter((entry) => entry.status === 'want' && entry.priority)
      .sort(newestFirst)
      .map((entry) => itemById.get(entry.itemId)!)
      .filter(Boolean)
      .slice(0, PROFILE_SHOWCASE_LIMIT),
    customized: configuredIds !== undefined,
  }
}
