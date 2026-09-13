import { execFileSync } from 'node:child_process'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function readTmdbTokenFromKeychain(): string {
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

function tmdbProxy(): Plugin {
  let accessToken = ''
  let apiKey = ''
  let musicBrainzQueue: Promise<unknown> = Promise.resolve()
  let lastMusicBrainzRequestAt = 0

  const fetchMusicBrainz = (url: URL) => {
    const request = musicBrainzQueue.then(async () => {
      const delay = Math.max(0, 1_100 - (Date.now() - lastMusicBrainzRequestAt))
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
      const result = await fetch(url, { headers: { 'User-Agent': 'Anthology/0.1 (local media tracker; http://127.0.0.1:4173)' } })
      lastMusicBrainzRequestAt = Date.now()
      return result
    })
    musicBrainzQueue = request.then(() => undefined, () => undefined)
    return request
  }

  const middleware: Connect.NextHandleFunction = async (request, response, next) => {
    if (request.url?.startsWith('/api/musicbrainz/')) {
      try {
        const upstream = new URL(request.url.replace('/api/musicbrainz', ''), 'https://musicbrainz.org')
        const result = await fetchMusicBrainz(upstream)
        response.statusCode = result.status
        response.setHeader('Content-Type', result.headers.get('content-type') ?? 'application/json')
        response.setHeader('Cache-Control', result.ok ? 'public, max-age=300' : 'no-store')
        response.end(new Uint8Array(await result.arrayBuffer()))
      } catch {
        response.statusCode = 502
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ code: 'MUSICBRAINZ_UPSTREAM_UNAVAILABLE' }))
      }
      return
    }
    if (request.url?.startsWith('/api/listenbrainz/')) {
      try {
        const upstream = new URL(request.url.replace('/api/listenbrainz', ''), 'https://api.listenbrainz.org')
        const result = await fetch(upstream, { headers: { 'User-Agent': 'Anthology/0.1 (local media tracker; http://127.0.0.1:4173)' } })
        response.statusCode = result.status
        response.setHeader('Content-Type', result.headers.get('content-type') ?? 'application/json')
        response.setHeader('Cache-Control', result.ok ? 'public, max-age=300' : 'no-store')
        response.end(new Uint8Array(await result.arrayBuffer()))
      } catch {
        response.statusCode = 502
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ code: 'LISTENBRAINZ_UPSTREAM_UNAVAILABLE' }))
      }
      return
    }
    if (request.url?.startsWith('/api/openlibrary/')) {
      try {
        const upstream = new URL(request.url.replace('/api/openlibrary', ''), 'https://openlibrary.org')
        const result = await fetch(upstream, { headers: { 'User-Agent': 'Anthology/0.1 (local media tracker prototype)' } })
        response.statusCode = result.status
        response.setHeader('Content-Type', result.headers.get('content-type') ?? 'application/json')
        response.setHeader('Cache-Control', result.ok ? 'public, max-age=300' : 'no-store')
        response.end(new Uint8Array(await result.arrayBuffer()))
      } catch {
        response.statusCode = 502
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ code: 'OPEN_LIBRARY_UPSTREAM_UNAVAILABLE' }))
      }
      return
    }
    if (!request.url?.startsWith('/api/tmdb/3/')) return next()
    if (!accessToken && !apiKey) {
      response.statusCode = 503
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ code: 'TMDB_NOT_CONFIGURED' }))
      return
    }

    try {
      const upstream = new URL(request.url.replace('/api/tmdb', ''), 'https://api.themoviedb.org')
      if (apiKey) upstream.searchParams.set('api_key', apiKey)
      const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
      const result = await fetch(upstream, { headers })
      response.statusCode = result.status
      response.setHeader('Content-Type', result.headers.get('content-type') ?? 'application/json')
      response.setHeader('Cache-Control', result.ok ? 'public, max-age=300' : 'no-store')
      response.end(new Uint8Array(await result.arrayBuffer()))
    } catch {
      response.statusCode = 502
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ code: 'TMDB_UPSTREAM_UNAVAILABLE' }))
    }
  }

  return {
    name: 'anthology-provider-proxy',
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir, '')
      accessToken = env.TMDB_READ_ACCESS_TOKEN?.trim() || readTmdbTokenFromKeychain()
      apiKey = env.TMDB_API_KEY?.trim() ?? ''
    },
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  plugins: [react(), tmdbProxy()],
  server: {
    host: '127.0.0.1',
    port: 4173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
})
