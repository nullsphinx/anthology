import type { LibraryEntry, MediaItem, MediaType, ProfileShowcases } from './domain'

export const PROFILE_SHOWCASE_LIMIT = 12

export type ProfileShelf = {
  type: MediaType
  completedCount: number
  queueCount: number
  favoriteCandidates: MediaItem[]
  nextUpCandidates: MediaItem[]
  favorites: MediaItem[]
  nextUp: MediaItem[]
  favoritesCustomized: boolean
  nextUpCustomized: boolean
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
  favoriteShowcases: ProfileShowcases = {},
  nextUpShowcases: ProfileShowcases = {},
): ProfileShelf {
  const itemById = new Map(items.filter((item) => item.type === type).map((item) => [item.id, item]))
  const typedEntries = entries.filter((entry) => entry.userId === userId && itemById.has(entry.itemId))
  const newestFirst = (left: LibraryEntry, right: LibraryEntry) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  const favoriteEntries = typedEntries.filter((entry) => entry.status === 'completed' && entry.favorite).sort(newestFirst)
  const queueEntries = typedEntries
    .filter((entry) => entry.status === 'want')
    .sort((left, right) => Number(right.priority) - Number(left.priority) || newestFirst(left, right))
  const favoriteCandidates = favoriteEntries.map((entry) => itemById.get(entry.itemId)!).filter(Boolean)
  const nextUpCandidates = queueEntries.map((entry) => itemById.get(entry.itemId)!).filter(Boolean)
  const favoriteIds = favoriteShowcases[type]
  const nextUpIds = nextUpShowcases[type]
  const favorites = favoriteIds
    ? favoriteIds.flatMap((id) => {
      const item = itemById.get(id)
      return item && favoriteEntries.some((entry) => entry.itemId === item.id) ? [item] : []
    })
    : favoriteCandidates.slice(0, PROFILE_SHOWCASE_LIMIT)
  const nextUp = nextUpIds
    ? nextUpIds.flatMap((id) => {
      const item = itemById.get(id)
      return item && queueEntries.some((entry) => entry.itemId === item.id) ? [item] : []
    })
    : nextUpCandidates.slice(0, PROFILE_SHOWCASE_LIMIT)

  return {
    type,
    completedCount: typedEntries.filter((entry) => entry.status === 'completed').length,
    queueCount: queueEntries.length,
    favoriteCandidates,
    nextUpCandidates,
    favorites,
    nextUp,
    favoritesCustomized: favoriteIds !== undefined,
    nextUpCustomized: nextUpIds !== undefined,
  }
}

export function reorderShowcaseItems(ids: string[], draggedId: string, targetId: string, position: 'before' | 'after' = 'before'): string[] {
  if (draggedId === targetId || !ids.includes(draggedId) || !ids.includes(targetId)) return ids
  const reordered = ids.filter((id) => id !== draggedId)
  const targetIndex = reordered.indexOf(targetId)
  reordered.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, draggedId)
  if (reordered.every((id, index) => id === ids[index])) return ids
  return reordered
}
