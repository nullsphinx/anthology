import { execFileSync } from 'node:child_process'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

type Provider = 'tmdb' | 'musicbrainz' | 'listenbrainz' | 'openlibrary'

const providers: Record<Provider, { origin: string; userAgent: string }> = {
  tmdb: { origin: 'https://api.themoviedb.org', userAgent: 'Anthology/0.2' },
  musicbrainz: { origin: 'https://musicbrainz.org', userAgent: 'Anthology/0.2 (https://anthologyshelf.com)' },
  listenbrainz: { origin: 'https://api.listenbrainz.org', userAgent: 'Anthology/0.2 (https://anthologyshelf.com)' },
  openlibrary: { origin: 'https://openlibrary.org', userAgent: 'Anthology/0.2 (https://anthologyshelf.com)' },
}

let musicBrainzQueue: Promise<void> = Promise.resolve()
let lastMusicBrainzRequestAt = 0

function readTmdbToken(): string {
  const configured = process.env.TMDB_READ_ACCESS_TOKEN?.trim()
  if (configured) return configured
  if (process.platform !== 'darwin') return ''
  try {
    return execFileSync('security', ['find-generic-password', '-a', process.env.USER ?? '', '-s', 'trove-tmdb', '-w'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

async function waitForMusicBrainz(): Promise<void> {
  const turn = musicBrainzQueue.then(async () => {
    const delay = Math.max(0, 1_100 - (Date.now() - lastMusicBrainzRequestAt))
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    lastMusicBrainzRequestAt = Date.now()
  })
  musicBrainzQueue = turn.catch(() => undefined)
  return turn
}

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string; path: string[] }> }) {
  const { provider: providerName, path } = await context.params
  if (!(providerName in providers)) return Response.json({ code: 'UNKNOWN_PROVIDER' }, { status: 404 })
  const provider = providerName as Provider
  const config = providers[provider]
  const upstream = new URL(`/${path.map(encodeURIComponent).join('/')}`, config.origin)
  request.nextUrl.searchParams.forEach((value, key) => upstream.searchParams.append(key, value))

  const headers = new Headers({ 'User-Agent': config.userAgent, Accept: 'application/json' })
  if (provider === 'tmdb') {
    const token = readTmdbToken()
    const apiKey = process.env.TMDB_API_KEY?.trim()
    if (!token && !apiKey) return Response.json({ code: 'TMDB_NOT_CONFIGURED' }, { status: 503 })
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (apiKey) upstream.searchParams.set('api_key', apiKey)
  }

  try {
    if (provider === 'musicbrainz') await waitForMusicBrainz()
    const response = await fetch(upstream, { headers, signal: AbortSignal.timeout(15_000) })
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/json',
        'Cache-Control': response.ok ? 'public, s-maxage=300, stale-while-revalidate=3600' : 'no-store',
      },
    })
  } catch {
    return Response.json({ code: `${provider.toUpperCase()}_UPSTREAM_UNAVAILABLE` }, { status: 502 })
  }
}
