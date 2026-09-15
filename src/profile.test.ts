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

  it('honors a custom order and separates priority queue items', () => {
    const items = [item('a'), item('b'), item('c')]
    const entries = [entry('a'), entry('b'), entry('c', { status: 'want', progress: 0, favorite: false, priority: true })]
    const shelf = buildProfileShelf('movie', items, entries, 'john', { movie: ['b', 'a'] })
    expect(shelf.favorites.map((candidate) => candidate.id)).toEqual(['b', 'a'])
    expect(shelf.priorities.map((candidate) => candidate.id)).toEqual(['c'])
    expect(shelf.queueCount).toBe(1)
    expect(shelf.customized).toBe(true)
  })

  it('normalizes untrusted showcase settings to allowed shelves and twelve unique IDs', () => {
    expect(normalizeProfileShowcases({ movie: ['a', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'], unknown: ['x'], book: 'bad' })).toEqual({ movie: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'] })
  })
})
