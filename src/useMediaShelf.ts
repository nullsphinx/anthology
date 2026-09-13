import { useCallback, useEffect, useMemo, useState } from 'react'
import { initialState } from './data'
import {
  clampProgress,
  getEntry,
  seasonEpisodeRange,
  totalEpisodes,
  type ActivityAction,
  type LibraryEntry,
  type LibraryStatus,
  type MediaItem,
  type ShelfState,
} from './domain'
import { loadRemoteShelf, removeRemoteEntry, saveRemoteEntry } from './lib/supabase/shelf'

const STORAGE_KEY = 'media-shelf-prototype-v2'

function loadState(): ShelfState {
  if (typeof window === 'undefined') return structuredClone(initialState)
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as ShelfState
      if (Array.isArray(parsed.items) && Array.isArray(parsed.entries)) return parsed
    }
  } catch {
    // Fall through to a clean shelf if local data is malformed.
  }
  return structuredClone(initialState)
}

function createEntry(userId: string, itemId: string): LibraryEntry {
  return {
    userId,
    itemId,
    status: 'want',
    progress: 0,
    progressSource: 'manual',
    watchedEpisodes: [],
    rating: null,
    completionCount: 0,
    updatedAt: new Date().toISOString(),
  }
}

function upsertItem(items: MediaItem[], item: MediaItem): MediaItem[] {
  const exists = items.some((candidate) => candidate.id === item.id)
  return exists
    ? items.map((candidate) => candidate.id === item.id ? { ...candidate, ...item } : candidate)
    : [...items, item]
}

export function useMediaShelf(remoteUserId?: string) {
  const [state, setState] = useState<ShelfState>(loadState)
  const [remoteLoading, setRemoteLoading] = useState(Boolean(remoteUserId))
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    if (!remoteUserId) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [remoteUserId, state])

  useEffect(() => {
    if (!remoteUserId) { setRemoteLoading(false); return }
    let active = true
    setRemoteLoading(true)
    loadRemoteShelf(remoteUserId)
      .then(({ items, entries }) => {
        if (active) setState({ currentUserId: remoteUserId, items, entries, activities: [] })
      })
      .catch(() => { if (active) setSyncError('Your saved library could not be loaded. Try refreshing.') })
      .finally(() => { if (active) setRemoteLoading(false) })
    return () => { active = false }
  }, [remoteUserId])

  const currentEntries = useMemo(
    () => state.entries.filter((entry) => entry.userId === state.currentUserId),
    [state.currentUserId, state.entries],
  )

  const updateEntry = useCallback((
    item: MediaItem,
    updater: (entry: LibraryEntry) => LibraryEntry,
    activity?: { action: ActivityAction; detail: string },
  ) => {
    setState((previous) => {
      const existing = getEntry(previous.entries, previous.currentUserId, item.id)
      const next = { ...updater(existing ?? createEntry(previous.currentUserId, item.id)), updatedAt: new Date().toISOString() }
      if (remoteUserId) queueMicrotask(() => saveRemoteEntry(item, next).catch(() => setSyncError('A library change could not be saved. Please try again.')))
      const entries = existing
        ? previous.entries.map((entry) => entry.userId === previous.currentUserId && entry.itemId === item.id ? next : entry)
        : [...previous.entries, next]
      return {
        ...previous,
        items: upsertItem(previous.items, item),
        entries,
        activities: activity ? [{
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          userId: previous.currentUserId,
          itemId: item.id,
          action: activity.action,
          detail: activity.detail,
          createdAt: new Date().toISOString(),
        }, ...previous.activities].slice(0, 80) : previous.activities,
      }
    })
  }, [remoteUserId])

  const setCurrentUser = useCallback((currentUserId: string) => {
    if (remoteUserId) return
    setState((previous) => ({ ...previous, currentUserId }))
  }, [remoteUserId])

  const saveItemDetails = useCallback((item: MediaItem) => {
    setState((previous) => {
      const entry = getEntry(previous.entries, previous.currentUserId, item.id)
      if (remoteUserId && entry) queueMicrotask(() => saveRemoteEntry(item, entry).catch(() => setSyncError('Updated title details could not be saved.')))
      return { ...previous, items: upsertItem(previous.items, item) }
    })
  }, [remoteUserId])

  const setStatus = useCallback((item: MediaItem, status: LibraryStatus) => {
    updateEntry(item, (entry) => {
      const isNewCompletion = status === 'completed' && entry.status !== 'completed'
      const episodeCount = totalEpisodes(item)
      return {
        ...entry,
        status,
        progress: status === 'completed' ? 100 : status === 'want' ? 0 : entry.progress,
        watchedEpisodes: status === 'completed' && episodeCount
          ? Array.from({ length: episodeCount }, (_, index) => index + 1)
          : status === 'want' ? [] : entry.watchedEpisodes,
        progressSource: status === 'completed' && item.type === 'show' && episodeCount ? 'episodes' : entry.progressSource,
        completionCount: isNewCompletion ? entry.completionCount + 1 : entry.completionCount,
      }
    }, {
      action: status === 'completed' ? 'completed' : status === 'in-progress' ? 'started' : status === 'paused' ? 'paused' : status === 'dropped' ? 'dropped' : 'saved',
      detail: status,
    })
  }, [updateEntry])

  const setProgress = useCallback((item: MediaItem, value: number) => {
    const progress = clampProgress(value)
    updateEntry(item, (entry) => ({
      ...entry,
      status: progress === 100 ? 'completed' : entry.status === 'paused' || entry.status === 'dropped' ? entry.status : 'in-progress',
      progress,
      progressSource: 'manual',
      completionCount: progress === 100 && entry.status !== 'completed' ? entry.completionCount + 1 : entry.completionCount,
    }), { action: 'progressed', detail: `${progress}% complete` })
  }, [updateEntry])

  const setRating = useCallback((item: MediaItem, stars: number) => {
    const rating = stars === 0 ? null : clampProgress(stars * 20)
    updateEntry(item, (entry) => ({ ...entry, rating }), {
      action: 'rated',
      detail: rating === null ? 'rating cleared' : `${stars} stars`,
    })
  }, [updateEntry])

  const toggleEpisode = useCallback((item: MediaItem, episode: number) => {
    if (!totalEpisodes(item)) return
    updateEntry(item, (entry) => {
      const watched = entry.watchedEpisodes.includes(episode)
        ? entry.watchedEpisodes.filter((candidate) => candidate !== episode)
        : [...entry.watchedEpisodes, episode].sort((a, b) => a - b)
      const progress = clampProgress((watched.length / totalEpisodes(item)) * 100)
      const completed = progress === 100
      return {
        ...entry,
        watchedEpisodes: watched,
        progress,
        progressSource: 'episodes',
        status: completed ? 'completed' : watched.length ? 'in-progress' : 'want',
        completionCount: completed && entry.status !== 'completed' ? entry.completionCount + 1 : entry.completionCount,
      }
    }, { action: 'progressed', detail: `episode ${episode}` })
  }, [updateEntry])

  const toggleSeason = useCallback((item: MediaItem, seasonNumber: number) => {
    const range = seasonEpisodeRange(item, seasonNumber)
    if (!range.length) return
    updateEntry(item, (entry) => {
      const complete = range.every((episode) => entry.watchedEpisodes.includes(episode))
      const watched = complete
        ? entry.watchedEpisodes.filter((episode) => !range.includes(episode))
        : [...new Set([...entry.watchedEpisodes, ...range])].sort((a, b) => a - b)
      const progress = clampProgress((watched.length / totalEpisodes(item)) * 100)
      return {
        ...entry,
        watchedEpisodes: watched,
        progress,
        progressSource: 'episodes',
        status: progress === 100 ? 'completed' : watched.length ? 'in-progress' : 'want',
        completionCount: progress === 100 && entry.status !== 'completed' ? entry.completionCount + 1 : entry.completionCount,
      }
    }, { action: 'progressed', detail: `season ${seasonNumber}` })
  }, [updateEntry])

  const removeItem = useCallback((itemId: string) => {
    setState((previous) => {
      const item = previous.items.find((candidate) => candidate.id === itemId)
      if (remoteUserId && item) queueMicrotask(() => removeRemoteEntry(item).catch(() => setSyncError('The title could not be removed. Please try again.')))
      const entries = previous.entries.filter((entry) => !(entry.userId === previous.currentUserId && entry.itemId === itemId))
      const stillReferenced = entries.some((entry) => entry.itemId === itemId)
      return { ...previous, entries, items: stillReferenced ? previous.items : previous.items.filter((item) => item.id !== itemId) }
    })
  }, [remoteUserId])

  const resetShelf = useCallback(() => {
    if (remoteUserId) return
    window.localStorage.removeItem(STORAGE_KEY)
    setState(structuredClone(initialState))
  }, [remoteUserId])

  return {
    state,
    currentEntries,
    setCurrentUser,
    saveItemDetails,
    setStatus,
    setProgress,
    setRating,
    toggleEpisode,
    toggleSeason,
    removeItem,
    resetShelf,
    remoteLoading,
    syncError,
    clearSyncError: () => setSyncError(null),
  }
}
