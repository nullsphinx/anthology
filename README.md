# Anthology

Anthology is an open-source, unified shelf for movies, television, books, and albums. It combines comprehensive provider-backed discovery with private personal tracking: planned, in progress, paused, completed, and dropped states; progress; ratings; episode tracking; repeat completions; group overlap; and personal recaps.

The project is currently an early-access alpha. New users can request an email invitation from the sign-in page and create a private profile after verifying their email. The catalog is real and searchable; authenticated shelf data persists in Postgres with row-level security.

## Stack

- Next.js 16 App Router, React 19, and TypeScript
- Supabase Postgres, Auth, and row-level security
- TMDB for movies and television, with Cinemeta fallback
- Open Library for books
- MusicBrainz, ListenBrainz, and Cover Art Archive for albums
- Vercel deployment and GitHub Actions CI

Provider responses are normalized into a shared `MediaItem` model. Catalog metadata and user-owned library state remain separate, and all credentialed provider requests run through allowlisted server routes.

## Run locally

Requirements: Node.js 22+, npm, Docker, and an internet connection.

```bash
npm install
npm run db:start
cp .env.example .env.local
```

Use the public local values printed by `npm run db:start` for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Do not copy the local secret key or service-role key into the browser configuration.

For TMDB on macOS, run `zsh scripts/configure-tmdb.sh`; it stores the read token in Keychain. On other systems, put `TMDB_READ_ACCESS_TOKEN` in the ignored `.env.local` file.

```bash
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). If Supabase variables are absent, Anthology runs in local demo mode and stores its simulated profiles in browser local storage.

## Verify

```bash
npm run db:reset
npm run db:test
npm test
npm run build
```

The database tests create isolated users and assert owner access plus cross-user privacy. The application tests cover statuses, progress, episode accounting, ratings, overlap, and recap calculations.

## Repository map

- `app/` — Next.js pages, auth callback, and server-side provider proxy
- `src/` — interface, catalog adapters, domain logic, auth gate, and persistence client
- `supabase/migrations/` — canonical production schema and RLS policies
- `supabase/tests/` — database authorization tests
- `docs/DEPLOYMENT.md` — Supabase, Vercel, and domain rollout runbook
- `PRODUCT_BRIEF.md` — product direction and data-model rationale

## Security and privacy

- Personal profiles and library entries are private by default.
- Browser clients cannot directly mutate shared catalog tables.
- Validated authenticated database functions resolve external IDs to internal UUIDs.
- TMDB credentials remain server-side.
- `.env` files are ignored; only `.env.example` is committed.

Report vulnerabilities privately as described in [SECURITY.md](./SECURITY.md).

## Contributing

Anthology is licensed under the [GNU Affero General Public License v3.0](./LICENSE). See [CONTRIBUTING.md](./CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before opening a pull request.
