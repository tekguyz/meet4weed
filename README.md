# Meet4Weed

A private social app for **verified Florida medical cannabis patients** to host
and join small gatherings at private residences.

Florida law allows qualified patients to consume at a private residence. The
app exists to make sure everyone in the room is one: every member holds a
valid, unexpired OMMU card, and nobody else gets in.

**It is a place to meet, never a place to buy or sell.** No cart, no payments
for cannabis, no dispensary ordering. That constraint is load-bearing.

> **Status: early rebuild.** Password sign-in, attestation, member profiles,
> card verification with an owner review queue, and the expiry lifecycle are
> built and proven end to end on a real phone with a real card (2026-09-18),
> and deployed to Vercel (2026-09-19).
> Sessions and everything after are designed but not built.
> See [Build status](#build-status).

---

## Stack

| Layer | Choice |
| :-- | :-- |
| App | Next.js 16.3 (App Router), React 19.2, TypeScript |
| Data | Supabase Postgres, hosted |
| Auth | Supabase Auth, email + password. Email carries links only to confirm an account and reset a password (spec §4.5) |
| Authorization | Postgres row-level security + column-level grants |
| Styling | Tailwind CSS v4, "Warm Ink" design tokens, dark by default |
| Validation | zod |
| Tests | vitest + Testing Library |
| CI | GitHub Actions |
| Card reading | Claude (`claude-sonnet-5`) — reads and lists concerns; a person approves |
| Face check on the phone | MediaPipe BlazeFace |
| Rate limits | Upstash Redis (shared; keys prefixed `m4w:`) |
| App email | Resend API |
| Hosting | Vercel — live at [meet4weed.vercel.app](https://meet4weed.vercel.app); `vercel.json` holds the cron schedule |

Auth email goes through Resend SMTP from `Meet4Weed <no-reply@tekguyz.com>`,
set in the Supabase dashboard, with the branded templates in
`supabase/templates/`. The owner's review alert and the expiry email go
through the Resend API from the same sender.

**Measured cost of one card check:** $0.0088 on average (spec §4.4).

**Deployed at** `https://meet4weed.vercel.app`. The two cron jobs in
`vercel.json` run there and refuse any call without `CRON_SECRET`. The ten
server variables in the table below are set in Production and Preview; the
three optional limits are left unset, so their defaults apply. Supabase
**Authentication → URL Configuration** must list that origin, or emailed links
point at localhost.

**Decided, not installed:** Claude vision for card reading, Mapbox, web push,
Sentry — see the spec.

---

## Getting started

### Prerequisites

- Node 22+
- The [Supabase CLI](https://supabase.com/docs/guides/cli)
- Access to the hosted Supabase project

**No Docker, no local database.** This project runs against a hosted Supabase
instance. See [Database](#database) for what that changes.

### Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`. `.env.example` names every variable and says where each
comes from:

| Variable | From |
| :-- | :-- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API |
| `ANTHROPIC_API_KEY` | Anthropic console → API Keys |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash → the database → REST API |
| `RESEND_API_KEY` | Resend → API Keys |
| `VERIFICATION_SECRET` | 32 random bytes, base64 — generate it; encrypts card photos |
| `CRON_SECRET` | 32 random bytes, hex — generate it; Vercel Cron sends it |
| `OWNER_ALERT_EMAIL` | Who gets the "card waiting for review" email |
| `VISION_DAILY_CEILING` | Optional, default 50 Claude checks per day |
| `DEV_LAN_HOST` | Optional, dev only — this computer's LAN IP for phone testing |

**Only the two `NEXT_PUBLIC_` values may ever reach the browser.** Every other
key is server-only: the Supabase secret key bypasses every security rule, and
the Anthropic key spends money. `.env.local` is git-ignored.

**Upstash is shared** with the TEKGUYZ Website database, because the free tier
allows one. Prefix every Meet4Weed key with `m4w:`.

Link the CLI to the project once:

```bash
supabase link --project-ref <project-ref>
```

### Run it

```bash
npm run dev
```

Open `http://localhost:3000`. Signed out, you land on `/login`.

For emailed links to work locally, the Supabase project must list
`http://localhost:3000/**` under **Authentication → URL Configuration →
Redirect URLs**. Supabase silently swaps in the Site URL for any address not on
that list.

### Auth settings live in two places

The hosted dashboard is what runs. `supabase/config.toml` and
`supabase/templates/` mirror it, and a test fails if they disagree with the
link lifetime the screens state. This repo never runs `supabase config push`,
so a change means editing both:

| Setting | Dashboard | Value |
| :-- | :-- | :-- |
| Confirm email | Authentication → Sign In / Providers → Email | on |
| Email OTP expiration | same page | 3600 seconds |
| Password rules | same page | 8 characters minimum; lower, upper, digit, symbol |
| Confirm signup template | Authentication → Emails | `supabase/templates/confirmation.html` |
| Reset password template | Authentication → Emails | `supabase/templates/recovery.html` |

---

## Scripts

| Command | Does |
| :-- | :-- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Every vitest suite, including the database security tests |
| `npm run db:push` | Apply new migrations to the linked hosted project |
| `npm run admin:grant -- <email>` | Make an existing account an admin |
| `npm run cron:run -- verification-reaper` | Run a cron job against the local dev server (also `expiry-sweep`) |
| `CRON_BASE_URL=https://localhost:3000 NODE_TLS_REJECT_UNAUTHORIZED=0 npm run cron:run -- …` | The same, while the HTTPS `dev-phone` server is running |
| `npm run fixtures:vision` | Re-render the synthetic card fixtures |
| `VISION_LIVE=1 npm run test:vision-live` | Call the real Claude API with the fixtures — **costs about 1 cent per case** |

**Testing the camera on a phone.** The camera needs HTTPS off localhost. Start
the `dev-phone` configuration in `.claude/launch.json`: it serves HTTPS on the
LAN with a self-signed certificate from `private/dev-cert/` (git-ignored; make
one with `openssl req -x509 … -addext "subjectAltName=IP:<LAN IP>"`), and
`DEV_LAN_HOST` in `.env.local` lets Next.js accept that origin. The phone shows
one certificate warning.

While that HTTPS server is the one running, `npm run cron:run` needs
`CRON_BASE_URL=https://localhost:3000` and `NODE_TLS_REJECT_UNAUTHORIZED=0`,
because it defaults to `http://localhost:3000` and the certificate is
self-signed.

There is no local-database script. `supabase start`, `db reset`, `db diff` and
`test db` all need Docker, which this project does not use.

---

## Database

Migrations live in `supabase/migrations/` and are the **single source of
truth**. There is no `supabase/schemas/` directory: declarative schemas are
diffed against a local shadow database, which needs Docker.

Write a migration by hand, then push it:

```bash
npm run db:push
```

### The rule that will bite you

The project was created with **"Automatically expose new tables" turned off**,
so a new table is invisible to everyone until a migration grants access —
**including the server's own `service_role`.**

`service_role` bypasses row-level *policies*. It does **not** bypass table
*privileges*, which are checked first. Every new table needs:

```sql
grant all on public.<table> to service_role;
```

Forget it and every server-side write to that table fails with `42501`.

---

## Tests

```bash
npm test
```

The security tests run against the hosted project and delete what they create:

- `supabase/tests/__tests__/profiles-rls.test.ts` — who can read and write profiles.
- `supabase/tests/__tests__/verification-rls.test.ts` — who can read a submission, decide one, or call the service-only functions.
- `supabase/tests/__tests__/verification-store.test.ts` — stored photos are ciphertext.
- `supabase/tests/__tests__/verification-reaper.test.ts` — the 7-day deletion.

They **skip themselves** when `SUPABASE_SECRET_KEY` is not set. CI has no
secret, so **CI does not run the security tests.** Run them locally before
merging anything that touches a migration.

`lib/verification/__tests__/vision.live.test.ts` calls the real Claude API and
runs only with `VISION_LIVE=1`. Every other vision test uses a mocked client.

---

## Project layout

```
app/                  routes: /login, /onboarding, /auth/confirm, /verify, /admin, /api/verification, /api/cron/*
components/           UI; ui/ holds the primitives
lib/auth/             auth error mapping, link lifetime, safe redirects
lib/supabase/         browser client, server client, session refresh
lib/profiles/         zod schemas, types, queries
lib/verification/     capture checks, limits, Claude reader, submission pipeline, reaper
lib/member/           read-only gate, expiry sweep
lib/admin/            review-queue queries
scripts/              admin grant, cron runner, fixtures, MediaPipe copy
proxy.ts              refreshes the session and gates signed-out visitors
supabase/migrations/  every schema change, in order
supabase/templates/   branded auth emails, mirrored in the dashboard
supabase/tests/       database security tests
docs/superpowers/     the design spec and the implementation plans
```

`proxy.ts` is Next.js 16's name for what used to be `middleware.ts`.

---

## Build status

The rebuild follows one spec and seven plans.

| Plan | Builds | Status |
| :-- | :-- | :-- |
| 01 | Scaffold, design tokens, auth, profiles | **Done** |
| 02 | Password auth, card verification with owner review queue, cost caps, expiry lifecycle | **Done** |
| 03 | Sessions, map, RSVP, address unlock | Next |
| 04 | Strains on deck, bring list, invite links | — |
| 05 | Notifications, push, installable PWA | — |
| 06 | Report, block, admin panel | — |
| 07 | Full design pass | — |

- **Spec:** [`docs/superpowers/specs/2026-09-16-meet4weed-rebuild-design.md`](docs/superpowers/specs/2026-09-16-meet4weed-rebuild-design.md)
- **Plans:** [`docs/superpowers/plans/`](docs/superpowers/plans/)

---

## History

This repository previously held a React + Vite + Netlify prototype built in
Google AI Studio. It ran entirely on mock data, with no database and no real
authentication. It was removed in the rebuild; its ideas carried into the spec,
its code did not. It is still in git history before commit `04381a5`.
