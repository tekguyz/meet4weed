# KB · Meet4Weed

> **Read this first.** This document describes a **rebuild in progress**, not a
> shipped product. As of the compile date, one of seven implementation plans is
> complete: sign-in, attestation and member profiles work against a real
> database. The feature that defines the product — card verification — is
> designed and not built. Nothing is deployed and there are no users.
>
> An earlier version of this file, generated in Google AI Studio against the
> previous prototype, described features that existed only as mock data. It
> has been replaced wholesale, not edited.

---

## 1. At a glance

| | |
| --- | --- |
| Repo | `tekguyz/meet4weed` (local folder `meet4weed`) |
| Source commit | `22b5711` |
| Compiled | 2026-09-16 |
| Deployed | **Not deployed.** Vercel is planned; no Vercel project is linked. |
| Site entry | None recorded. Not listed in the tekguyz.com KB index. |
| Public access | None. Runs locally only. |
| Database | Hosted Supabase project `uckylbulmbrsdjevhbct`, us-east-1, free tier |
| Payments | **Out of scope.** Facilitating a cannabis sale is prohibited outright — see §6. |
| Tests | 51 passing across 8 files, as of 2026-09-16 |

**Launch posture, and it is load-bearing:** private and small first — friends
and a closed group, not a public marketplace. Build to a production bar, but do
not build scale, moderation staffing or trust-and-safety tooling ahead of
users.

---

## 2. The problem it solves

Florida medical cannabis patients may consume together at a private residence.
There is no dedicated, verification-first way for them to find each other and
organise that.

General social networks restrict cannabis-related gatherings and cannot prove
that everyone attending is a legal cardholder. Meet4Weed's reason to exist is
that proof: **every member holds a valid, unexpired Florida OMMU card, and
nobody else gets in.** Around that gate sit small private gatherings
("seshes"), member profiles built on strain and consumption preferences, and
coordination of who is bringing what.

---

## 3. Why it was built

### 3.1 The rebuild

The repository previously held a **React 19 + Vite + Netlify prototype built in
Google AI Studio**, one of the owner's first applications. It was replaced
rather than upgraded. Recorded reasons, from the design spec (§1.1):

- **No persistence.** All state lived in React context, seeded from constants.
  A reload reset everything.
- **No real authentication.** Login accepted any seeded account with the
  literal password `password`.
- **A serverless function that could not run locally.** The card-check
  function targeted Netlify Functions, but `netlify.toml` and `_redirects` were
  both empty, so it 404'd under `npm run dev`.
- **Tailwind from a CDN script**, not a build.
- **Two React roots** mounting simultaneously from two `<script>` tags.

Carried forward: the **ideas** — sessions, strain contributions, the
notification types, preference matching. Not carried forward: any code, the
cold neon-green-on-black visual language, or the Gemini-based card check.

### 3.2 What is not recorded about origin

No launch date, target member count, business model, or funding exists in the
repository. None should be inferred.

---

## 4. What it actually does

**Shipped behaviour only.** Everything in §4.2 is designed and unbuilt.

### 4.1 Working now

**Sign-in — email magic link.**

- A member enters an email; Supabase sends a one-time link; `/auth/callback`
  exchanges the code for a session cookie.
- **No Google sign-in.** An unverified OAuth consent screen shows every new
  user a warning that the app is untrusted. It returns once the consent screen
  is verified.
- The form returns **the same message whether or not the address is
  registered**, so it cannot be used to discover who is a member.
- `/auth/callback` accepts a `next` redirect only if it is a same-site path.
  Without that check the callback is an open redirect that arrives with a
  fresh session attached.
- Sign-out is `POST`-only, so an `<img>` tag on another page cannot trigger it.

**Session gating — `proxy.ts`.** Runs on every request, refreshes the auth
cookie, and redirects signed-out visitors to `/login`. Public prefixes:
`/login`, `/auth`, `/legal`, `/invite`. Uses `getUser()` rather than
`getSession()`, because `getSession()` only decodes a cookie the client could
forge.

**Attestation — onboarding step 1.** Four separate checkboxes, all required:
21 or older; Florida resident; holds a valid, unexpired OMMU card; will never
use the app to buy or sell. Separate boxes rather than one blanket "I agree",
because the record of *which* claim a member made is the point. Stored as a
timestamp on `profiles.attested_at`.

**Profile — onboarding step 2.** Handle, display name, city, bio, preferred
strain types, consumption methods, and up to eight vibe tags. Saving redirects
home. Revisiting `/onboarding` once finished redirects home.

**Home.** A placeholder screen: signed-in handle, card status, a theme toggle,
and sign-out. It states that card verification is not built yet.

**Themes.** Dark by default, with light and system options. A script in
`<head>` applies the stored choice before first paint, so there is no flash on
load.

### 4.2 Designed, not built

From the spec, in build order:

| Plan | Scope |
| --- | --- |
| 02 | Card + live-selfie capture, Claude vision read, auto-approve or human review queue, image retention reaper, expiry sweep, read-only gate on expiry |
| 03 | Seshes, feed, map, host-approved RSVP, fuzzy location with address unlock, expiry-aware RSVP block |
| 04 | Strains on deck, bring list with an explicit "bringing none", signed expiring invite links |
| 05 | In-app notifications, web push, installable PWA |
| 06 | Report, block, host kick, admin panel with audit log |
| 07 | Full design pass across every route, both themes |

Deferred past v1: direct messages, crews, preference matching, event photos,
and an Expo native client. **Permanently out:** a browser extension, and any
sales, cart or ordering feature.

---

## 5. Tech stack

### 5.1 Installed

| Layer | Package / service | Version |
| --- | --- | --- |
| Framework | `next` (App Router, Turbopack) | 16.3.5 |
| UI runtime | `react`, `react-dom` | 19.2.8 |
| Language | `typescript` | 7.0.2 |
| Database + auth | Supabase (hosted), `@supabase/supabase-js`, `@supabase/ssr` | 2.112.4, 0.12.5 |
| Styling | `tailwindcss`, `@tailwindcss/postcss` | 4.3.3 |
| Validation | `zod` | 4.5.4 |
| Client state | `zustand` | 5.0.15 — **installed, not yet imported anywhere** |
| Tests | `vitest`, Testing Library, `jsdom` | 4.1.11 |
| Env loading (tests) | `dotenv` | ^17.2.3 |
| Fonts | Fraunces (display), Inter (body), via `next/font` | — |
| CI | GitHub Actions: typecheck, test, build | — |

### 5.2 Decided, not installed

Vercel hosting and Vercel Analytics · Claude vision (`claude-sonnet-5`) for card
reading · Mapbox GL JS · Web Push (VAPID) + service worker · Resend · Upstash
Redis · Sentry · Motion · shadcn/ui.

PostHog was considered and deferred to v2: there is nothing to analyse before
launch.

---

## 6. Architecture worth knowing

**Authorization is a database property, not a UI property.** The core promise
— a host's home address is visible only to approved guests — is meant to be
enforced by Postgres so that a UI bug cannot leak it. Plan 01 establishes that
pattern on `profiles`; the address rules themselves arrive in Plan 03.

**`status` and `card_expires_on` are protected by column-level grants, not a
trigger.** `authenticated` holds `UPDATE` on nine named columns and no others.
Column privileges are checked before row-level security and cannot be worked
around by a differently shaped `UPDATE`. A member who tries to set their own
status gets `42501`. Only `service_role` can write those columns.

**There is no insert or delete grant for members.** A `SECURITY DEFINER`
trigger on `auth.users` creates the profile at signup, and the row is removed
by `on delete cascade`. A member cannot create a second profile or delete their
own row to escape a suspension.

**RLS is enabled but deliberately not forced.** `force row level security`
applies policies to the table owner. `handle_new_user()` is `SECURITY DEFINER`
owned by `postgres`; with FORCE on and no insert policy, it cannot insert and
signup fails. `service_role` bypasses policies by the `BYPASSRLS` attribute,
not ownership, so FORCE would add nothing.

**The Supabase project has "Automatically expose new tables" turned off.**
Every table is unreachable until a migration grants access. This is
intentional, and it produces the landmine in §8.

**The placeholder handle is a state marker.** Signup writes
`member_<12 hex chars>`. `app/page.tsx` and `/onboarding` treat that prefix as
"onboarding unfinished", and the handle schema rejects any member-chosen handle
starting with `member_`.

**Design tokens live in one file.** `app/globals.css` declares every colour as
OKLCH on `:root` (dark) and re-points the same names under `.light`, mapped into
Tailwind through `@theme inline`. Components use token classes only. The
approved palette is "Warm Ink, Level 2": warm brown-black base, cream text, sage
`#B4D982` primary, honey `#E7B968` secondary.

**No local database.** The development machine has no Docker. Migrations are
written by hand and applied with `supabase db push --linked`. `supabase/migrations/`
is the only schema source.

---

## 7. Build status and known gaps

**Complete:** Plan 01 of 7 — scaffold and CI, design tokens for both themes,
Supabase clients and session refresh, `profiles` with its privilege model and
security tests, magic-link auth, and onboarding. Walked end to end by hand on
2026-09-16: sign-in, attestation, profile save, redirect home, theme persistence.

**Known gaps:**

- **CI does not run the database security tests.** They skip without
  `SUPABASE_SECRET_KEY`, and CI has none. They must be run locally.
- **The security tests run against the hosted project**, creating and deleting
  real auth users on each run.
- **No card verification.** Every member is `unverified`, and nothing yet
  depends on that status.
- **Magic-link email uses Supabase's built-in SMTP**, which is rate-limited on
  the free tier. Resend is decided and not wired.
- **The Supabase Site URL points at `https://meet4weed.vercel.app`**, which does
  not exist yet.
- **`/legal` and `/invite` are listed as public routes in `proxy.ts` but
  neither route exists.**
- **Terms and privacy copy are not written.** The spec requires them before any
  account other than the owner's is verified, because the card-image retention
  promise is a commitment to users.
- **The home screen is placeholder copy.**

**Deliberately not built:** Google sign-in (unverified OAuth warning); a local
Supabase stack (no Docker); pgTAP (replaced by an integration test that also
covers the API layer).

---

## 8. Hard rules

**Every new table needs `grant all on public.<table> to service_role`.**
*Cost:* the security test found that `service_role` had no privileges on
`profiles` at all. With auto-expose off, nothing is granted to anyone,
including `service_role` — whose `BYPASSRLS` attribute skips row policies but
not table privileges, which run first. Without the grant, every server-side
write fails with `42501`. Card verification would have failed on its first
real request. Fixed in `20260916083000_profiles_service_role_grants.sql`.

**A server action must not name a column the member cannot write, even with an
unchanged value.** Postgres rejects the whole `UPDATE` with `42501` if any named
column lacks a grant. `saveProfile` lists its columns explicitly for this
reason, and a test asserts `status` and `card_expires_on` are never sent.

**The last step of a flow must move the user on.** *Cost:* found in the
2026-09-16 walkthrough. `saveProfile` wrote the row correctly, then returned
"Saved." and left the member on a form they had already completed with no way
forward. It now redirects, and a test asserts the redirect fires on success
and not on failure.

**Do not verify the built CSS by searching for `oklch`.** *Cost:* the plan's
original proof command could never pass. Lightning CSS compiles every `oklch()`
to a hex value plus a `lab()` fallback, so the string does not survive the
build. Check for the token name and its hex instead — `--primary:#b4d982`.

---

## 9. Accuracy notes

Contradictions between the repository's own documents and its code, as of
`22b5711`. Recorded, not resolved.

1. **Spec §2 says the database uses "declarative schemas + migrations + seed."**
   The repository has no `supabase/schemas/` directory and no seed file. Only
   migrations exist, because declarative diffing needs a Docker shadow database.

2. **Spec §9 says the RLS matrix is tested with "pgTAP or SQL test harness."**
   It is a vitest integration test at
   `supabase/tests/__tests__/profiles-rls.test.ts`, run through the API.

3. **Plan 01's Global Constraints say every table gets
   `force row level security`,** and Task 4's original steps include it. The
   migration deliberately omits it (§6). The plan records the reversal in an
   amendment block at the top of Task 4, but the Global Constraints line and
   the superseded steps below the amendment were left unchanged.

4. **Plan 01 Task 4's original steps describe a trigger guarding `status` and
   `card_expires_on`.** The shipped migration uses column-level grants and has
   no such trigger. Same amendment block; same unchanged steps beneath it.

5. **`package.json` defines `db:start`, `db:reset`, `db:diff` and `db:test`.**
   All four require a local Docker stack and do not work in this project's
   setup.

6. **`.env.example` defaults `NEXT_PUBLIC_SUPABASE_URL` to
   `http://127.0.0.1:54321`,** a local-stack address. The project uses a hosted
   instance.

7. **Spec §2 lists Resend for "magic links + the single expiry email."**
   Magic links are currently sent by Supabase's built-in SMTP.

8. **`components/onboarding/profile-form.tsx` still renders a success message
   branch** for `state.ok === true`. Since `saveProfile` now redirects on
   success, that branch is unreachable.

9. **Every dependency in `package.json` is pinned exactly except `dotenv`,**
   which uses a caret range.
