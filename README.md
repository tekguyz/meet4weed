# Meet4Weed

A private social app for **verified Florida medical cannabis patients** to host
and join small gatherings at private residences.

Florida law allows qualified patients to consume at a private residence. The
app exists to make sure everyone in the room is one: every member holds a
valid, unexpired OMMU card, and nobody else gets in.

**It is a place to meet, never a place to buy or sell.** No cart, no payments
for cannabis, no dispensary ordering. That constraint is load-bearing.

> **Status: early rebuild.** Sign-in, attestation and member profiles work.
> Card verification, sessions and everything else are designed but not built.
> See [Build status](#build-status).

---

## Stack

| Layer | Choice |
| :-- | :-- |
| App | Next.js 16.3 (App Router), React 19.2, TypeScript |
| Data | Supabase Postgres, hosted |
| Auth | Supabase Auth. Magic link today; **moving to email + password** (spec §4.5) |
| Authorization | Postgres row-level security + column-level grants |
| Styling | Tailwind CSS v4, "Warm Ink" design tokens, dark by default |
| Validation | zod |
| Tests | vitest + Testing Library |
| CI | GitHub Actions |
| Hosting | Vercel *(planned — not deployed yet)* |

**Configured, not yet used by code:** Resend SMTP sends auth email from
`Meet4Weed <no-reply@tekguyz.com>` (set in the Supabase dashboard). Keys for
Claude, Upstash and the Resend API are in `.env.local`, ready for Plan 02.

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

For the magic link to work locally, the Supabase project must list
`http://localhost:3000/**` under **Authentication → URL Configuration →
Redirect URLs**.

---

## Scripts

| Command | Does |
| :-- | :-- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Every vitest suite, including the database security tests |
| `npm run db:push` | Apply new migrations to the linked hosted project |

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

`supabase/tests/__tests__/profiles-rls.test.ts` is the security test. It
creates two real members in the hosted project, checks what each can and
cannot read or write through the real API, and deletes them afterwards.

It **skips itself** when `SUPABASE_SECRET_KEY` is not set. CI has no secret, so
**CI does not run the security tests.** Run them locally before merging
anything that touches a migration.

---

## Project layout

```
app/                  routes: /login, /onboarding, /auth/callback, /auth/sign-out
components/           UI; ui/ holds the primitives
lib/supabase/         browser client, server client, session refresh
lib/profiles/         zod schemas, types, queries
proxy.ts              refreshes the session and gates signed-out visitors
supabase/migrations/  every schema change, in order
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
| 02 | Password auth, card verification with owner review queue, cost caps, expiry lifecycle | Next |
| 03 | Sessions, map, RSVP, address unlock | — |
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
