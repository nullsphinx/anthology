import { afterEach, describe, expect, it, vi } from 'vitest'
import { browseCinemetaCatalog as browseCatalog, clearCatalogCache, normalizeCinemeta } from './catalog'
import { browseTmdbCatalog } from './tmdb'
import { browseOpenLibraryCatalog, fetchOpenLibraryDetails, normalizeOpenLibrary } from './openlibrary'
import { browseMusicCatalog, fetchMusicDetails, normalizeListenBrainz, normalizeMusicBrainzSearch } from './musicbrainz'
import {
  clampProgress,
  getGroupMetrics,
  getProgressLabel,
  getStatusLabel,
  getUserStats,
  seasonEpisodeRange,
  totalEpisodes,
  type LibraryEntry,
  type MediaItem,
} from './domain'

const movie: MediaItem = {
  id: 'cinemeta:movie:tt1', externalId: 'tt1', title: 'Test Movie', type: 'movie', year: 2020,
  releaseInfo: '2020', genres: ['Drama'], summary: 'Summary', creator: 'Director', runtimeMinutes: 100,
  communityRating: 8, provider: 'Cinemeta', providerUrl: 'https://www.imdb.com/title/tt1/',
}

const show: MediaItem = {
  id: 'cinemeta:show:tt2', externalId: 'tt2', title: 'Test Show', type: 'show', year: 2021,
  releaseInfo: '2021–2023', genres: ['Crime'], summary: 'Summary', creator: 'Creator', runtimeMinutes: 48,
  seasons: [{ number: 1, title: '8 episodes', episodes: 8 }, { number: 2, title: '8 episodes', episodes: 8 }],
  communityRating: 9, provider: 'Cinemeta', providerUrl: 'https://www.imdb.com/title/tt2/',
}

const entry = (overrides: Partial<LibraryEntry> = {}): LibraryEntry => ({
  userId: 'john', itemId: movie.id, status: 'in-progress', progress: 40, progressSource: 'manual',
  watchedEpisodes: [], rating: 80, completionCount: 0, updatedAt: '2026-09-12T00:00:00.000Z', ...overrides,
})

describe('media domain', () => {
  afterEach(() => {
    clearCatalogCache()
    vi.unstubAllGlobals()
  })
  it('keeps manual progress within valid bounds', () => {
    expect(clampProgress(-12)).toBe(0)
    expect(clampProgress(42.4)).toBe(42)
    expect(clampProgress(140)).toBe(100)
  })

  it('calculates episode totals and season ranges', () => {
    expect(totalEpisodes(show)).toBe(16)
    expect(seasonEpisodeRange(show, 2)).toEqual([9, 10, 11, 12, 13, 14, 15, 16])
  })

  it('labels partial progress without calling it complete', () => {
    const partial = entry({ status: 'dropped', progress: 70 })
    expect(getProgressLabel(movie, partial)).toBe('70%')
  })

  it('uses book-specific lifecycle language', () => {
    expect(getStatusLabel('want', 'book')).toBe('Want to read')
    expect(getStatusLabel('in-progress', 'book')).toBe('Reading')
    expect(getStatusLabel('completed', 'book')).toBe('Read')
    expect(getStatusLabel('want', 'movie')).toBe('Want to watch')
    const finishedBook = entry({ status: 'completed', progress: 100, completionCount: 1 })
    expect(getProgressLabel({ ...movie, type: 'book' }, finishedBook)).toBe('Read')
    expect(getProgressLabel({ ...movie, type: 'book' }, { ...finishedBook, completionCount: 2 })).toBe('2 reads')
  })

  it('uses album-specific lifecycle and repeat-listening language', () => {
    expect(getStatusLabel('want', 'album')).toBe('Want to listen')
    expect(getStatusLabel('in-progress', 'album')).toBe('Listening')
    expect(getStatusLabel('completed', 'album')).toBe('Listened')
    expect(getStatusLabel('dropped', 'album')).toBe('Stopped listening')
    const finishedAlbum = entry({ status: 'completed', progress: 100, completionCount: 1 })
    expect(getProgressLabel({ ...movie, type: 'album' }, finishedAlbum)).toBe('Listened')
    expect(getProgressLabel({ ...movie, type: 'album' }, { ...finishedAlbum, completionCount: 3 })).toBe('3 listens')
  })

  it('counts a prior completion while a rewatch is active', () => {
    const rewatching = entry({ completionCount: 1 })
    const metrics = getGroupMetrics([movie], [rewatching], ['john'])[0]
    expect(metrics.completed).toBe(1)
    expect(metrics.active).toBe(1)
  })

  it('includes completed and partial activity in screen-time estimates', () => {
    const entries = [entry({ status: 'completed', progress: 100, completionCount: 1 }), entry({ itemId: show.id, progressSource: 'episodes', watchedEpisodes: [1, 2] })]
    const stats = getUserStats([movie, show], entries, 'john')
    expect(stats.completed).toBe(1)
    expect(stats.episodes).toBe(2)
    expect(stats.minutes).toBe(196)
  })

  it('normalizes real provider metadata into the shared media model', () => {
    const normalized = normalizeCinemeta({ id: 'tt0903747', imdb_id: 'tt0903747', type: 'series', name: 'Breaking Bad', releaseInfo: '2008–2013', genres: ['Crime'], imdbRating: '9.5', videos: [{ season: 1, episode: 1, released: '2008-01-20' }] })
    expect(normalized.id).toBe('cinemeta:show:tt0903747')
    expect(normalized.type).toBe('show')
    expect(normalized.communityRating).toBe(9.5)
    expect(normalized.seasons).toEqual([{ number: 1, episodes: 1, title: '1 episodes' }])
    expect(normalizeCinemeta({ id: 'tt0', type: 'movie', name: 'Unrated', imdbRating: '' }).communityRating).toBeNull()
  })

  it('maps application pages to provider offsets without loading more than 100 records', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      const type = url.includes('/series/') ? 'series' : 'movie'
      const skip = Number(url.match(/skip=(\d+)/)?.[1] ?? 0)
      return new Response(JSON.stringify({ metas: Array.from({ length: 50 }, (_, index) => ({
        id: `${type}-${skip + index}`,
        type,
        name: `${type} ${skip + index}`,
        releaseInfo: '2020',
      })) }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await browseCatalog({ page: 7, pageSize: 100, types: ['movie', 'show'] })
    expect(result.items).toHaveLength(100)
    expect(result.hasNext).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(expect.arrayContaining([
      expect.stringContaining('/movie/top/skip=300.json'),
      expect.stringContaining('/series/top/skip=300.json'),
    ]))
  })

  it('uses the native year catalog and applies an additional genre constraint', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const skip = Number(String(input).match(/skip=(\d+)/)?.[1] ?? 0)
      return new Response(JSON.stringify({ metas: Array.from({ length: 50 }, (_, index) => ({
      id: `movie-${skip + index}`,
      type: 'movie',
      name: `Movie ${skip + index}`,
      releaseInfo: (skip + index) % 5 === 0 ? '1998' : '1999',
      genres: [(skip + index) % 3 === 0 ? 'Drama' : 'Crime'],
    })) }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await browseCatalog({ page: 1, pageSize: 100, types: ['movie'], year: 1999, genre: 'Crime' })
    expect(result.items).toHaveLength(100)
    expect(fetchMock.mock.calls[0][0]).toContain('/year/catalog/movie/year/genre=1999&skip=0.json')
    expect(result.items.every((item) => item.year === 1999 && item.genres.includes('Crime'))).toBe(true)
  })

  it('sorts top-rated results numerically and always places missing ratings last', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      const type = url.includes('/series/') ? 'series' : 'movie'
      const skip = Number(url.match(/skip=(\d+)/)?.[1] ?? 0)
      return new Response(JSON.stringify({ metas: Array.from({ length: 50 }, (_, index) => {
        const value = skip + index
        return {
          id: `${type}-${value}`,
          type,
          name: value === 17 ? 'Breaking Bad' : `${type} ${value}`,
          releaseInfo: '2020',
          imdbRating: value === 17 ? '9.5' : value % 13 === 0 ? '' : String(5 + (value % 40) / 10),
        }
      }) }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await browseCatalog({ page: 1, pageSize: 100, types: ['show'], sort: 'rating' })
    expect(result.items).toHaveLength(100)
    expect(result.items.every((item, index) => index === 0 || (result.items[index - 1].communityRating ?? -1) >= (item.communityRating ?? -1))).toBe(true)
    expect(result.items[0].title).toBe('Breaking Bad')
    expect(result.items[0].communityRating).toBe(9.5)
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('/top/'))).toBe(true)
  })

  it('composes search, year, and genre without leaking near matches', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const skip = Number(String(input).match(/skip=(\d+)/)?.[1] ?? 0)
      return new Response(JSON.stringify({ metas: Array.from({ length: 50 }, (_, index) => {
        const value = skip + index
        return {
          id: `movie-${value}`,
          type: 'movie',
          name: value % 2 ? `Batman ${value}` : `Batwoman ${value}`,
          releaseInfo: value % 3 ? '2008' : '2007',
          genres: [value % 5 ? 'Crime' : 'Comedy'],
        }
      }) }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await browseCatalog({ page: 1, pageSize: 100, types: ['movie'], query: 'Batman', year: 2008, genre: 'Crime' })
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.every((item) => item.title.includes('Batman') && item.year === 2008 && item.genres.includes('Crime'))).toBe(true)
    expect(fetchMock.mock.calls[0][0]).toContain('/top/catalog/movie/top/search=Batman&skip=0.json')
  })

  it('keeps the selected order authoritative while search filters are active', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const skip = Number(String(input).match(/skip=(\d+)/)?.[1] ?? 0)
      if (skip > 0) return new Response('', { status: 404 })
      return new Response(JSON.stringify({ metas: [
        { id: 'z', type: 'movie', name: 'Batman Z', releaseInfo: '2008', imdbRating: '9.4' },
        { id: 'a', type: 'movie', name: 'Batman A', releaseInfo: '2008', imdbRating: '6.1' },
      ] }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const alphabetical = await browseCatalog({ page: 1, pageSize: 100, types: ['movie'], query: 'Batman', sort: 'title-asc' })
    expect(alphabetical.items.map((item) => item.title)).toEqual(['Batman A', 'Batman Z'])
    expect(alphabetical.hasNext).toBe(false)
  })

  it('uses TMDB discover pagination and sorts community ratings numerically', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input), 'http://localhost')
      const page = Number(url.searchParams.get('page'))
      return new Response(JSON.stringify({
        page,
        total_pages: 500,
        total_results: 10_000,
        results: Array.from({ length: 20 }, (_, index) => {
          const value = (page - 1) * 20 + index
          return {
            id: value,
            name: value === 67 ? 'Breaking Bad' : `Show ${value}`,
            first_air_date: '2008-01-20',
            genre_ids: [80, 18],
            vote_average: value === 67 ? 9.5 : 9.1 - (value % 20) / 100,
          }
        }),
      }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await browseTmdbCatalog({ page: 1, pageSize: 100, types: ['show'], sort: 'rating' })
    expect(result.items).toHaveLength(100)
    expect(result.items[0]).toMatchObject({ title: 'Breaking Bad', communityRating: 9.5, provider: 'TMDB' })
    expect(result.items.every((item, index) => index === 0 || (result.items[index - 1].communityRating ?? -1) >= (item.communityRating ?? -1))).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/tmdb/3/discover/tv?')
    expect(String(fetchMock.mock.calls[0][0])).toContain('sort_by=vote_average.desc')
    expect(String(fetchMock.mock.calls[0][0])).toContain('vote_count.gte=200')
  })

  it('sends combined year and genre constraints to TMDB discover', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input), 'http://localhost')
      const page = Number(url.searchParams.get('page'))
      return new Response(JSON.stringify({
        page,
        total_pages: 5,
        total_results: 100,
        results: Array.from({ length: 20 }, (_, index) => ({
          id: (page - 1) * 20 + index,
          title: `Crime Movie ${(page - 1) * 20 + index}`,
          release_date: '1999-06-01',
          genre_ids: [80],
          vote_average: 7.5,
        })),
      }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await browseTmdbCatalog({ page: 1, pageSize: 100, types: ['movie'], year: 1999, genre: 'Crime', sort: 'popular' })
    expect(result.items).toHaveLength(100)
    expect(result.items.every((item) => item.year === 1999 && item.genres.includes('Crime'))).toBe(true)
    const firstUrl = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    expect(firstUrl.pathname).toBe('/api/tmdb/3/discover/movie')
    expect(firstUrl.searchParams.get('primary_release_year')).toBe('1999')
    expect(firstUrl.searchParams.get('with_genres')).toBe('80')
  })

  it('searches the full TMDB title index instead of only browsed pages', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input), 'http://localhost')
      const isTv = url.pathname.endsWith('/tv')
      return new Response(JSON.stringify({
        page: 1,
        total_pages: 1,
        total_results: 1,
        results: [{ id: isTv ? 1396 : 550, name: isTv ? 'Breaking Bad' : undefined, title: isTv ? undefined : 'Fight Club', first_air_date: '2008-01-20', release_date: '1999-10-15', genre_ids: [80, 18], vote_average: 9.5 }],
      }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await browseTmdbCatalog({ page: 1, pageSize: 100, types: ['movie', 'show'], query: 'Breaking Bad', sort: 'popular' })
    expect(result.items.some((item) => item.title === 'Breaking Bad')).toBe(true)
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/search/tv?'))).toBe(true)
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('query=Breaking+Bad'))).toBe(true)
  })

  it('normalizes Open Library works with real covers, authors, and ten-point ratings', () => {
    const item = normalizeOpenLibrary({
      key: '/works/OL45804W', title: '  Fantastic   Mr. Fox  ', author_name: ['Roald Dahl'],
      first_publish_year: 1970, cover_i: 123, subject: ['Fantasy fiction', 'Children'], ratings_average: 4.25,
    })
    expect(item).toMatchObject({
      id: 'openlibrary:book:OL45804W', externalId: 'OL45804W', type: 'book', year: 1970,
      creator: 'Roald Dahl', genres: ['Fiction', 'Fantasy', 'Children'], communityRating: 8.5,
      provider: 'Open Library',
    })
    expect(item.title).toBe('Fantastic Mr. Fox')
    expect(item.posterUrl).toContain('/123-M.jpg')
  })

  it('paginates and composes Open Library book filters server-side', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input), 'http://localhost')
      const page = Number(url.searchParams.get('page'))
      return new Response(JSON.stringify({
        start: (page - 1) * 100,
        numFound: 850,
        docs: Array.from({ length: 100 }, (_, index) => ({
          key: `/works/OL${page}${index}W`, title: `Fantasy Book ${index}`,
          author_name: ['Test Author'], first_publish_year: 1999, cover_i: 5000 + index,
          subject: ['Fantasy'], ratings_average: 4 - index / 100,
        })),
      }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await browseOpenLibraryCatalog({ page: 2, pageSize: 100, types: ['book'], genre: 'Fantasy', year: 1999, sort: 'rating' })
    expect(result.items).toHaveLength(100)
    expect(result.hasNext).toBe(true)
    expect(result.source).toBe('Open Library')
    expect(result.items.every((item) => item.type === 'book' && item.year === 1999 && item.genres.includes('Fantasy'))).toBe(true)
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    expect(requestUrl.pathname).toBe('/api/openlibrary/search.json')
    expect(requestUrl.searchParams.get('page')).toBe('2')
    expect(requestUrl.searchParams.get('limit')).toBe('100')
    expect(requestUrl.searchParams.get('q')).toContain('subject:"Fantasy"')
    expect(requestUrl.searchParams.get('q')).toContain('first_publish_year:1999')
    expect(requestUrl.searchParams.get('sort')).toBe('rating')
  })

  it('escapes Open Library query syntax so punctuation remains literal search text', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) => new Response(JSON.stringify({ start: 0, numFound: 0, docs: [] })))
    vi.stubGlobal('fetch', fetchMock)
    await browseOpenLibraryCatalog({ page: 1, pageSize: 100, types: ['book'], query: 'Harry Potter: (Book 1)', sort: 'popular' })
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    expect(requestUrl.searchParams.get('q')).toBe('(Harry Potter\\: \\(Book 1\\)) AND language:eng')
  })

  it('loads complete Open Library work details and ratings', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/ratings.json')) return new Response(JSON.stringify({ summary: { average: 4.6, count: 200 } }))
      return new Response(JSON.stringify({
        key: '/works/OL45804W', title: 'Fantastic Mr. Fox', description: { value: 'A complete work description.' },
        covers: [9876], subjects: ['Fantasy fiction', 'Children'], first_publish_date: '1970',
      }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const item = normalizeOpenLibrary({ key: '/works/OL45804W', title: 'Fantastic Mr. Fox', author_name: ['Roald Dahl'] })
    const details = await fetchOpenLibraryDetails(item)
    expect(details.summary).toBe('A complete work description.')
    expect(details.communityRating).toBe(9.2)
    expect(details.posterUrl).toContain('/9876-L.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('normalizes ListenBrainz popularity records with MusicBrainz metadata and cover art', () => {
    const item = normalizeListenBrainz({
      release_group_mbid: 'b1392450-e666-3926-a536-22c65f834433',
      release_group_name: 'OK Computer', artist_name: 'Radiohead', listen_count: 1_254_408,
    }, {
      artist: { name: 'Radiohead' },
      release_group: { name: 'OK Computer', date: '1997-05-21', type: 'Album' },
      tag: { release_group: [
        { tag: 'alternative rock', count: 25, genre_mbid: 'genre-1' },
        { tag: 'rock', count: 13, genre_mbid: 'genre-2' },
      ] },
    }, 1)
    expect(item).toMatchObject({
      id: 'musicbrainz:album:b1392450-e666-3926-a536-22c65f834433',
      title: 'OK Computer', creator: 'Radiohead', type: 'album', year: 1997,
      releaseInfo: '1997-05-21', genres: ['Alternative Rock', 'Rock'], provider: 'MusicBrainz',
      catalogRank: 1, communityRating: null,
    })
    expect(item?.posterUrl).toContain('/release-group/b1392450-e666-3926-a536-22c65f834433/front-250')
  })

  it('loads popularity-ranked album pages and excludes non-album release groups', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input), 'http://localhost')
      if (url.pathname.includes('/stats/sitewide/release-groups')) {
        return new Response(JSON.stringify({ payload: {
          count: 100, offset: 0, total_release_group_count: 20_000_000,
          release_groups: [
            { release_group_mbid: 'single-id', release_group_name: 'A Single', artist_name: 'Artist', listen_count: 300 },
            { release_group_mbid: 'album-1', release_group_name: 'Album One', artist_name: 'Artist One', listen_count: 200 },
            { release_group_mbid: 'album-1', release_group_name: 'Album One', artist_name: 'Artist One', listen_count: 200 },
            { release_group_mbid: 'album-2', release_group_name: 'Album Two', artist_name: 'Artist Two', listen_count: 100 },
          ],
        } }))
      }
      return new Response(JSON.stringify({
        'single-id': { release_group: { name: 'A Single', type: 'Single' }, artist: { name: 'Artist' } },
        'album-1': { release_group: { name: 'Album One', type: 'Album', date: '2001-01-01' }, artist: { name: 'Artist One' } },
        'album-2': { release_group: { name: 'Album Two', type: 'Album', date: '2002-01-01' }, artist: { name: 'Artist Two' } },
      }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await browseMusicCatalog({ page: 1, pageSize: 2, types: ['album'], sort: 'popular' })
    expect(result.items.map((item) => item.title)).toEqual(['Album One', 'Album Two'])
    expect(result.items.every((item) => item.type === 'album')).toBe(true)
    expect(result.hasNext).toBe(true)
    expect(result.source).toBe('MusicBrainz')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('searches the comprehensive MusicBrainz album index with artist, genre, and year constraints', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => new Response(JSON.stringify({
      count: 2, offset: 0, 'release-groups': [
        { id: 'z', title: 'Z Album', 'first-release-date': '2015-03-01', 'primary-type': 'Album', 'artist-credit': [{ name: 'Kendrick Lamar' }] },
        { id: 'a', title: 'A Album', 'first-release-date': '2015-01-01', 'primary-type': 'Album', 'artist-credit': [{ name: 'Kendrick Lamar' }] },
      ],
    })))
    vi.stubGlobal('fetch', fetchMock)
    const result = await browseMusicCatalog({ page: 1, pageSize: 100, types: ['album'], query: 'To Pimp a Butterfly', genre: 'Hip Hop', year: 2015, sort: 'title-asc' })
    expect(result.items.map((item) => item.title)).toEqual(['A Album', 'Z Album'])
    expect(result.items.every((item) => item.year === 2015 && item.genres.includes('Hip Hop'))).toBe(true)
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    expect(requestUrl.pathname).toBe('/api/musicbrainz/ws/2/release-group/')
    expect(requestUrl.searchParams.get('query')).toContain('releasegroup:(To Pimp a Butterfly) OR artist:(To Pimp a Butterfly)')
    expect(requestUrl.searchParams.get('query')).toContain('tag:"hip hop"')
    expect(requestUrl.searchParams.get('query')).toContain('firstreleasedate:[2015-01-01 TO 2015-12-31]')
    expect(requestUrl.searchParams.get('limit')).toBe('100')
  })

  it('loads MusicBrainz album details with ratings, genres, release count, and larger artwork', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: 'b1392450-e666-3926-a536-22c65f834433', title: 'OK Computer',
      'first-release-date': '1997-05-21', 'primary-type': 'Album',
      'artist-credit': [{ name: 'Radiohead' }],
      genres: [{ name: 'alternative rock', count: 25 }, { name: 'art rock', count: 13 }],
      rating: { value: 4.55, 'votes-count': 88 },
      releases: [{ id: 'release-1' }, { id: 'release-2' }],
    })))
    vi.stubGlobal('fetch', fetchMock)
    const item = normalizeMusicBrainzSearch({ id: 'b1392450-e666-3926-a536-22c65f834433', title: 'OK Computer', 'artist-credit': [{ name: 'Radiohead' }] })
    const details = await fetchMusicDetails(item)
    expect(details).toMatchObject({ title: 'OK Computer', creator: 'Radiohead', year: 1997, communityRating: 9.1 })
    expect(details.genres).toEqual(['Alternative Rock', 'Art Rock'])
    expect(details.posterUrl).toContain('/front-500')
    expect(details.summary).toContain('2 release editions')
  })
})
