import { describe, expect, it } from 'vitest'
import type { LibraryEntry, MediaItem } from './domain'
import { buildProfileShelf, normalizeProfileShowcases, PROFILE_SHOWCASE_LIMIT } from './profile'

const item = (id: string): MediaItem => ({ id, externalId: id, title: id, type: 'movie', year: 2026, releaseInfo: '2026', genres: [], summary: '', creator: '', communityRating: 8, provider: 'TMDB', providerUrl: '' })
const entry = (itemId: string, overrides: Partial<LibraryEntry> = {}): LibraryEntry => ({ userId: 'john', itemId, status: 'completed', progress: 100, progressSource: 'manual', watchedEpisodes: [], rating: null, completionCount: 1, favorite: true, priority: false, review: '', completedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...overrides })

describe('profile shelves', () => {
  it('defaults to the twelve most recently updated favorites', () => {
    const items = Array.from({ length: 14 }, (_, index) => item(`movie-${index}`))
    const entries = items.map((candidate, index) => entry(candidate.id, { updatedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString() }))
    const shelf = buildProfileShelf('movie', items, entries, 'john')
    expect(shelf.favorites.map((candidate) => candidate.id)).toEqual(['movie-13', 'movie-12', 'movie-11', 'movie-10', 'movie-9', 'movie-8', 'movie-7', 'movie-6', 'movie-5', 'movie-4', 'movie-3', 'movie-2'])
    expect(shelf.favorites).toHaveLength(PROFILE_SHOWCASE_LIMIT)
    expect(shelf.completedCount).toBe(14)
  })

  it('honors a custom order and puts priority items first in the next-up queue', () => {
    const items = [item('a'), item('b'), item('c'), item('d')]
    const entries = [
      entry('a'),
      entry('b'),
      entry('c', { status: 'want', progress: 0, favorite: false, priority: true, updatedAt: '2026-01-01T00:00:00Z' }),
      entry('d', { status: 'want', progress: 0, favorite: false, priority: false, updatedAt: '2026-02-01T00:00:00Z' }),
    ]
    const shelf = buildProfileShelf('movie', items, entries, 'john', { movie: ['b', 'a'] })
    expect(shelf.favorites.map((candidate) => candidate.id)).toEqual(['b', 'a'])
    expect(shelf.nextUp.map((candidate) => candidate.id)).toEqual(['c', 'd'])
    expect(shelf.queueCount).toBe(2)
    expect(shelf.customized).toBe(true)
  })

  it('fills next up from the newest watchlist entries when nothing is prioritized', () => {
    const items = Array.from({ length: 14 }, (_, index) => item(`queued-${index}`))
    const entries = items.map((candidate, index) => entry(candidate.id, {
      status: 'want',
      progress: 0,
      favorite: false,
      updatedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    }))
    const shelf = buildProfileShelf('movie', items, entries, 'john')
    expect(shelf.nextUp.map((candidate) => candidate.id)).toEqual(['queued-13', 'queued-12', 'queued-11', 'queued-10', 'queued-9', 'queued-8', 'queued-7', 'queued-6', 'queued-5', 'queued-4', 'queued-3', 'queued-2'])
    expect(shelf.queueCount).toBe(14)
  })

  it('normalizes untrusted showcase settings to allowed shelves and twelve unique IDs', () => {
    expect(normalizeProfileShowcases({ movie: ['a', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'], unknown: ['x'], book: 'bad' })).toEqual({ movie: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'] })
  })
})
