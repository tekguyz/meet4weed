# Stack, layout, invite links and the demo

Moved from the old README.

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
| Web push | `web-push` with the project's own VAPID keys, no push vendor. Push text names nobody ([ADR 0002](docs/adr/0002-discreet-push-text.md)) |
| Installable app | Web manifest + a service worker that caches the app shell only ([ADR 0001](docs/adr/0001-app-shell-caching-only.md)) |
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

**Decided, not installed:** Claude vision for card reading, Mapbox,
Sentry — see the spec.

## Project layout

```
app/                  routes: /login, /onboarding, /auth/confirm, /invite, /admin, /api/verification, /api/cron/*
app/(frame)/          signed-in routes inside the Frame: /, /seshes, /verify, /me
components/           UI; ui/ holds the primitives, sesh/ the sesh screens, frame/ the Frame
lib/auth/             auth error mapping, link lifetime, safe redirects
lib/supabase/         browser client, server client, session refresh
lib/profiles/         zod schemas, types, queries
lib/sesh/             sesh and RSVP queries, invite tokens, the column lists
lib/verification/     capture checks, limits, Claude reader, submission pipeline, reaper
lib/member/           read-only gate, what the Frame shows, where-you-stand, expiry sweep
lib/admin/            review-queue queries
lib/forms/            shared form helpers
scripts/              admin grant, cron runner, fixtures, MediaPipe copy
proxy.ts              refreshes the session and gates signed-out visitors
supabase/migrations/  every schema change, in order
supabase/templates/   branded auth emails, mirrored in the dashboard
supabase/tests/       database security tests
docs/PLANS.md         which plan covers which build-order steps, and where it lives
docs/superpowers/     the design spec, and Plans 01-02 as files
```

`proxy.ts` is Next.js 16's name for what used to be `middleware.ts`.

### An invite link, opened by somebody with no account

`/invite/[token]` is public, and a signed-out visitor sees **exactly** the
page a member sees: title, start time, button. The split happens on the
press, and nowhere else.

| Press | What happens |
| --- | --- |
| Signed out | Nothing is spent. The token goes into `m4w_held_invite` — `httpOnly`, `SameSite=Lax`, 30 minutes — and they are sent to `/login?mode=sign-up`. The redirect carries no token. |
| Signed in | The use is spent, the claim row is written, and the cookie is dropped. |

They land back on the invite page after confirming their email (or after
signing in), and **press it a second time**. That press is the one that
spends.

**A redirect never spends a use.** One rule, one place. A second, invisible
way to spend one would be the hardest thing in this app to debug the day it
went wrong.

The signed-out page has no session, so the server reads the preview for
them with the service-role key after checking the token's HMAC tag.
`public.invite_preview()` is **not** granted to `anon` and will not be: the
anon key reaches the Data API straight from a browser. It *is* granted to
`service_role` (`20260921100000_invite_preview_service_role.sql`) — without
that grant every cold invite page raised `42501`. `mint`, `revoke` and
`redeem` stay member-only.

The claim is written even though nobody has reviewed their card yet — that
is what makes the link wait across a multi-day review. `private.can_browse`
still refuses them the sesh, so they land on `/invite/held`, which says so
and names no sesh. The day a reviewer approves the card, the sesh is there.

---

## The demo

A visitor presses **Try the demo** on the landing page or `/login`. The server
makes them their own anonymous identity inside the **demo realm** and opens the
sesh feed, full of an invented **cast** of South Florida members and seshes. The
two realms cannot see each other, a visitor never sees another visitor, and
each visitor is deleted seven days after arriving. Issue #39,
[ADR 0003](docs/adr/0003-demo-visitors-over-a-shared-cast.md), and the Realm,
Cast and Visitor entries in [`CONTEXT.md`](CONTEXT.md).

- **The walls** are row-level security, in `supabase/migrations/…_demo_realm.sql`.
- **The cast** is `supabase/demo-cast.sql`. Edit it, then `npm run demo:cast`.
- **The door** is `app/demo-actions.ts`: a POST only, 5 visitors an hour per
  IP and 100 an hour in total.
- **The switch** is `DEMO_MODE_ENABLED=true` in Vercel. Off closes both buttons
  and the action.
- **Each night** the expiry sweep moves the cast's dates forward and deletes
  visitors older than seven days.
