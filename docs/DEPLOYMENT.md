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

For self-service invitations, keep general user creation, the Email provider, and **Confirm email** enabled. Keep the Before User Created Postgres hook configured: it permits only non-expired, unclaimed emails in `public.invites`. Apply `20260925010000_self_service_invites.sql` before deploying the updated form. The “Request an invite” flow calls the restricted `request_invite` function to register signup eligibility, then requests a Supabase email link. This intentionally allows anyone with an email address to request access; no administrator approval is required. It does not grant a session or expose invite records. Supabase verifies mailbox ownership before the user can create their profile.

Configure custom SMTP in Supabase Authentication before accepting public requests: the built-in mail sender restricts recipient addresses and has low delivery limits. Set appropriate Auth email rate limits. Both **Confirm signup** and **Magic Link** email templates must contain a link to `{{ .ConfirmationURL }}`. New users receive the signup confirmation template; returning users receive the magic-link template. Suggested signup subject: “Your Anthology invite”, with link text “Join Anthology and create your profile”.

The form uses `shouldCreateUser: true` so existing manually issued invitations also continue to work. Pending self-service invites expire after 24 hours and can be renewed by requesting again. Email-link expiry is controlled separately by Supabase Auth. Claimed invitations are never reopened; existing users can request another link to sign in. The callback establishes a session and the app asks users without a username to complete profile setup. Profiles remain private by default.

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


## Invitation release verification

With local Supabase running, apply pending migrations using `npx supabase migration up --local`, then run `npm run db:test`, `npm test`, and `npm run build`. Point the local app at local Supabase. Request an invite using a new test email and open its email in the local mail viewer at http://127.0.0.1:54324. Follow the link, choose a display name, username and avatar, and create the profile. Reload to confirm it persists; sign out and request another link for the same email. Also check an expired link and an already-taken username. Do not send production test invitations to real people without permission.


## Anthology email sender

The authentication sending domain is `auth.anthologyshelf.com`, verified in Resend. Use sender `Anthology <noreply@auth.anthologyshelf.com>`, SMTP host `smtp.resend.com`, port `465`, username `resend`, and a Resend key restricted to **Sending access** on that domain. Enter the credential directly in Supabase's SMTP password field; never commit it or use a `NEXT_PUBLIC_` variable for it. Keep open/click tracking disabled for authentication links.

GoDaddy hosts the DNS zone. Resend verification uses `resend._domainkey.auth` (TXT, public DKIM key from Resend), `rsend.auth` (CNAME to `rsend.forge.rmta.net`), and `send.auth` (CNAME to `send.forge.rmta.net`). Manage the exact verification values in the Resend domain dashboard. The original website records are independent of these records.

To test actual mailbox delivery from localhost, use the hosted project's public URL and publishable key in the ignored `.env.local`, with `http://127.0.0.1:4173/auth/callback` allowed in Supabase. This uses real hosted accounts and data. For isolated testing, switch those two variables back to the values from local `supabase status`; messages then arrive in the local mail viewer instead of external inboxes. Restart or reload the dev server after changing environment configuration.

For delivery failures, check Supabase Auth errors and Resend's delivery events before retrying. A successful send request does not prove inbox delivery. Restore a known working SMTP configuration if a replacement fails; disabling custom SMTP restores Supabase's limited default sender and does not provide general public delivery.
