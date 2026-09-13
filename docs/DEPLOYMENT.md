# Anthology deployment

Anthology uses Supabase for Postgres and authentication and Vercel for the Next.js application. Secrets belong in hosted environment settings, never in Git.

## 1. Link the existing Supabase project

Run these from the repository root. The login command opens Supabase's secure browser authorization; do not paste an access token into chat or commit it.

```bash
npx supabase login
npx supabase projects list
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Confirm the linked project is the `anthologyshelf` project in the `Anthology` organization before accepting any migration prompt. `db push` applies the versioned files under `supabase/migrations/`; it does not use the database password in application code.

In Supabase Dashboard → Authentication → URL Configuration, set:

- Site URL: `https://anthologyshelf.com`
- Redirect URLs: `https://anthologyshelf.com/auth/callback` and `http://127.0.0.1:4173/auth/callback`

For the invite-only alpha, keep both general user creation and the Email provider enabled so passwordless sign-in can issue magic links. Enforce private access with the configured Before User Created Postgres hook: it permits only non-expired, unclaimed emails in `public.invites`. Add the allowlist row before inviting a user. The client also sets `shouldCreateUser: false` so its sign-in form never requests account creation.

Google OAuth is intentionally off by default. When ready, configure Google's OAuth credentials in Supabase, add Supabase's displayed callback URL in Google Cloud, and set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` in Vercel. The existing Before User Created hook will apply the same `public.invites` allowlist to new OAuth users.

## 2. Create and configure Vercel

Import `https://github.com/nullsphinx/anthology` into Vercel as a Next.js project. Add these Production and Preview variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=https://anthologyshelf.com
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
TMDB_READ_ACCESS_TOKEN
```

The first two values come from Supabase Dashboard → Project Settings → API. Use the publishable key, not a service-role or secret key. Add the TMDB read token only as a Vercel secret environment variable.

## 3. Attach the domain

Add both `anthologyshelf.com` and `www.anthologyshelf.com` to the Vercel project. Make the apex domain primary and configure `www` to redirect to it. Vercel will display the exact DNS records required; copy those records into the domain's GoDaddy DNS panel and remove only conflicting parked records.

Wait for Vercel to report valid DNS and an issued TLS certificate before changing Supabase's Site URL. Then verify:

```text
https://anthologyshelf.com
https://www.anthologyshelf.com  -> redirects to apex
https://anthologyshelf.com/auth/callback
```

## 4. Release check

Run locally before every production migration or deployment:

```bash
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm test
npm run build
```

Never run `supabase db reset` against a linked production database. It is a local-development command; hosted changes use reviewed migrations and `supabase db push`.
