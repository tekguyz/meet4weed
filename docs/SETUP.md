# Setup, scripts and database

Moved from the old README. Nothing was removed.

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
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web push keys — `npx web-push generate-vapid-keys`. Without both, push is off and the feed still works |
| `DEV_LAN_HOST` | Optional, dev only — this computer's LAN IP for phone testing |
| `DEMO_MODE_ENABLED` | Optional. `true` opens the demo door (#39); anything else closes it. Server-side only, never `NEXT_PUBLIC_` |

**Only the `NEXT_PUBLIC_` values may ever reach the browser.** Every other
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
| Anonymous sign-ins | Authentication → Sign In / Providers | on — the demo door (#39) needs it |

---

## Scripts

| Command | Does |
| :-- | :-- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Prints an error and exits 1. Use the two below |
| `npm run test:unit` | Every vitest suite except the database security tests |
| `npm run test:integration` | The database security tests, one file at a time |
| `npm run db:push` | Apply new migrations to the linked hosted project |
| `npm run demo:cast` | Apply `supabase/demo-cast.sql`, the demo cast, to the linked project. Safe to re-run |
| `npm run admin:grant -- <email>` | Make an existing account an admin |
| `npm run cron:run -- verification-reaper` | Run a cron job against the local dev server (also `expiry-sweep`) |
| `npm run cron:run -- verification-reaper --https` | The same, while the HTTPS `dev-phone` server is running |
| `npm run fixtures:vision` | Re-render the synthetic card fixtures |
| `VISION_LIVE=1 npm run test:vision-live` | Call the real Claude API with the fixtures — **costs about 1 cent per case** |

**Testing the camera on a phone.** The camera needs HTTPS off localhost. Start
the `dev-phone` configuration in `.claude/launch.json`: it serves HTTPS on the
LAN with a self-signed certificate from `private/dev-cert/` (git-ignored; make
one with `openssl req -x509 … -addext "subjectAltName=IP:<LAN IP>"`), and
`DEV_LAN_HOST` in `.env.local` lets Next.js accept that origin. The phone shows
one certificate warning.

While that HTTPS server is the one running, add `--https` to
`npm run cron:run`, because the script defaults to `http://localhost:3000`
and the `dev-phone` server always uses port 3443:

```bash
npm run cron:run -- verification-reaper --https
```

`--https` talks to `https://localhost:3443` and trusts
`private/dev-cert/cert.pem` for that one request. It does **not** set
`NODE_TLS_REJECT_UNAUTHORIZED`. Keep that variable out of `.env.local`: every
script and `npm test` load that file, so a value there would turn off
certificate checks for every local Node process, not just this one command.

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
