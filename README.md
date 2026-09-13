# Anthology

A working, local-first prototype for discovering and tracking movies, television, books, and albums in one table. It supports planned, in-progress, paused, completed, and dropped states; manual or episode-level progress; half-star ratings; rewatches, rereads, and repeat listens; group overlap; and personal statistics.

## Run locally

Requirements: Node.js 22 or newer, npm, and an internet connection for live catalog metadata and poster images.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Verify

```bash
npm test
npm run build
```

## Live catalog behavior

- Uses TMDB as the primary movie and TV catalog when `TMDB_READ_ACCESS_TOKEN` or `TMDB_API_KEY` is configured server-side.
- Uses Open Library's full-text work index and cover service for books, with no client-side API credential.
- Uses MusicBrainz's release-group index for comprehensive album and artist search.
- Uses ListenBrainz for the most-listened album landing pages and the Cover Art Archive for real album artwork.
- Falls back automatically to Cinemeta when TMDB is not configured or temporarily unavailable, so the prototype remains usable.
- Loads at most 100 records per page and divides that budget evenly across the selected live media types.
- Searches the providers' full indexes as the user types, so a title does not need to appear on a browse page to be discoverable.
- Uses TMDB discovery endpoints for genre, exact release year, popularity, top-rated, and alphabetical ordering.
- Uses Open Library search filters for subject, first publication year, popularity, community rating, and title ordering.
- Uses MusicBrainz search fields for album title, artist, genre tag, release year, and page-local alphabetical ordering.
- Uses real cover images, identifiers, release data, genres, authors or credits, summaries, community ratings, runtimes, seasons, and released episode counts when available.
- Fetches a full metadata record only when a title is opened.
- Stores only titles added to a user's shelf in browser `localStorage`.
- Requires no embedded API secret.

TMDB's official API supplies the primary movie, television, image, search, and discovery data. Open Library supplies book works, ratings, and covers. MusicBrainz supplies album release groups, ratings, and genres; ListenBrainz supplies popularity ranking; and the Cover Art Archive supplies artwork. Cinemeta remains the no-credential movie and TV fallback.

## TMDB setup

1. Run `zsh scripts/configure-tmdb.sh` and paste your TMDB API Read Access Token at its hidden prompt. The script stores it in macOS Keychain, not in the repository or shell history.
2. Restart `npm run dev` or `npm run preview`.

For non-macOS environments, copy `.env.example` to `.env` and set `TMDB_READ_ACCESS_TOKEN` or `TMDB_API_KEY`. The Vite server proxy adds the credential to upstream requests; it is never bundled into browser code. `.env` files are ignored by version control.

## Interface capabilities

- Browse the catalog or switch to the current profile's shelf in the same table.
- Move through 100-record pages without loading off-screen posters or retaining thousands of catalog rows in memory.
- Combine movie, TV, book, and album filters in the same table.
- Filter by every lifecycle status or titles not yet added.
- Add a title directly from a row and change its status in place.
- Open a detail drawer for full metadata, progress, ratings, and TV episode tracking.
- Switch between four local prototype profiles.
- Inspect the friend-group overlap matrix and live personal recap.

## Architecture boundary

Provider response shapes are normalized in `src/tmdb.ts`, `src/openlibrary.ts`, `src/musicbrainz.ts`, and `src/catalog.ts`; the rest of the app depends only on the shared `MediaItem` model. User activity is stored separately from catalog records.

For production, move provider requests behind a cache-aware server, use an approved production catalog agreement, and replace browser persistence/profile simulation with authenticated PostgreSQL records and tested row-level access rules. [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) contains the fuller product and data model.

## Important limitations

- This is a functional prototype, not a production authentication or privacy implementation.
- The profile switcher simulates invited users; local profile separation is not a security boundary.
- Live catalog availability depends on the external metadata provider and network access.
- ListenBrainz popularity browsing is intentionally capped at its top 1,000 release groups; comprehensive album discovery remains available through MusicBrainz search and filtered browsing.
- MusicBrainz community ratings are often sparse and are loaded on album detail pages. Listen counts are kept separate and are never presented as ratings.
