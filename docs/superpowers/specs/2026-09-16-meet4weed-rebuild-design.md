# Meet4Weed — Rebuild Design Spec

**Date:** 2026-09-16
**Status:** Approved for planning
**Supersedes:** the `meet4weed-beta` prototype (React 19 + Vite + Netlify, mock in-memory state)

---

## 1. Purpose

A private, invite-conscious social app for **verified Florida OMMU medical
cannabis cardholders** to host and join small private gatherings ("seshes") at
private residences.

Florida law permits qualified patients to consume at a private residence. The
app's entire reason to exist is the **verification gate**: every member is a
cardholder with a valid, unexpired card. Nobody else gets in.

**The app never facilitates a sale.** No cart, no payments for cannabis, no
dispensary ordering, no "who's selling." This is a social layer only. This
constraint is product-defining, not a footnote — it is what keeps the app
lawful and keeps it off platform blocklists.

### 1.1 Why a rebuild, not an upgrade

The prototype has no persistence, no real auth (`pass === 'password'`), a
serverless function that cannot run locally, a Tailwind CDN script instead of a
build, and two React roots mounting simultaneously. Its **ideas** are good; its
**code** is not a foundation. We take the ideas and rebuild.

### 1.2 Launch posture

Private / small launch first: friends and a closed group, not a public
marketplace. Build to a production bar, but do not gold-plate scale, trust &
safety tooling, or moderation staffing before there are users.

---

## 2. Tech stack

Matches the house conventions already proven in `tekguyz-squid-ink`.

| Layer | Choice | Why |
| :-- | :-- | :-- |
| App framework | **Next.js 16.3** (App Router) | Server components keep the phone bundle small; house standard |
| Runtime | React 19.2 | House standard |
| Language | TypeScript | House standard |
| Hosting | **Vercel** | Vercel CLI already in use |
| Database | **Supabase Postgres** (hosted) | Supabase CLI already in use. Hand-written migrations in `supabase/migrations/`, applied with `supabase db push --linked`. No declarative schemas and no seed: both need a local Docker stack this project does not have |
| Auth | **Supabase Auth — email + password** | Decided 2026-09-16, replacing magic link. Meet4Weed is an installed PWA: on iOS a magic link opens Safari rather than the installed app, so the member signs in in the wrong place. Email carries links only to confirm an account and reset a password. Follows the proven `tekguyz-squid-ink` pattern. No Google provider: unverified OAuth consent screen |
| Files | Supabase Storage (private buckets) | Only used for the review queue, see §4 |
| Realtime | Supabase Realtime | Live RSVP counts in v1; DM chat in v2 |
| Authorization | **Postgres RLS** | Address privacy enforced in the DB, not the UI |
| Styling | **Tailwind v4** (`@tailwindcss/postcss`) + shadcn/ui | House standard; primitives only, not the look |
| Design direction | **Warm Ink, Level 2** (see §7) | Approved |
| Motion | Motion (`motion/react`) | Micro-interactions |
| Validation | **zod** | Shared between client, server actions, and DB boundaries |
| Client state | **zustand** | Only for genuinely client-side state (filters, camera flow) |
| Maps | **Mapbox GL JS** | Fuzzy circles and avatar pins; cheaper and more styleable than Google Maps |
| Card reading | **Claude vision** (`claude-sonnet-5`) | Structured output via zod schema |
| Push | Web Push (VAPID) + service worker | PWA, no app store |
| Email | Resend | Two paths. **Auth emails** (confirm and reset only) are sent by Supabase Auth over Resend SMTP — configured in the dashboard 2026-09-16, sender `Meet4Weed <no-reply@tekguyz.com>`, delivery confirmed; branded Warm Ink templates in `supabase/templates/`. **App emails** (the owner's review alert, the single expiry notice) are sent by the app through the Resend API with `RESEND_API_KEY` |
| Rate limiting | Upstash Redis | Verification attempts, RSVP spam, sesh-post spam, report spam. **Shares the TEKGUYZ Website database** — the free tier allows one. Every Meet4Weed key is prefixed `m4w:` so the two apps never collide, and both apps draw on the same free-tier allowance |
| Errors | Sentry | The camera/vision flow fails on phones we do not own; without it those failures are invisible |
| Analytics | Vercel Analytics | One line, free. PostHog deferred to v2 — nothing to analyse pre-launch |
| Tests | **vitest** + Testing Library | House standard |

**Explicitly not now:** React Native / Expo (Play Store is hostile to cannabis
apps and demands report+block tooling we would be building anyway), and a
browser extension (dropped by the user — do not revive it).

---

## 3. Architecture

Three layers, deliberately thin:

1. **App (Next.js on Vercel).** Server Components render feeds and detail
   pages. Server Actions handle writes. Route Handlers exist only where a
   third party must POST to us or where we stream a file.
2. **Data (Supabase Postgres).** Every table carries RLS. Authorization is a
   database property. A UI bug cannot leak a home address because the row
   never leaves Postgres.
3. **Jobs.** Vercel Cron hits protected route handlers:
   - daily expiry sweep (flip expired accounts to read-only, send the one email)
   - session reminder dispatch (24h before)
   - review-queue reaper (delete card images older than 7 days)

### 3.1 Design for isolation

Each unit below must be understandable and testable on its own.

| Unit | Does | Depends on |
| :-- | :-- | :-- |
| `auth` | Password sign-in, sign-up with email confirmation, password reset, session, sign-out | Supabase Auth |
| `verification` | Card + face-with-card capture, challenge, on-device pre-checks, vision read, review queue, owner alert, cost log | Claude API, Storage, Upstash, Resend, `member` |
| `member` | Profile, preferences, card status, read-only gate | `verification` |
| `sesh` | Create / edit / cancel a session, capacity, fuzzy geo | `member` |
| `rsvp` | Request, host approve/deny, address unlock, expiry-aware block | `sesh`, `member` |
| `ondeck` | Strain contributions and bring-list items | `sesh`, `rsvp` |
| `invite` | Signed, expiring share links | `sesh` |
| `notify` | In-app feed + web push fan-out | all of the above |
| `safety` | Report, block, host kick | `member`, `sesh` |
| `admin` | Review queue, reports queue, overrides, audit log | all of the above |

Nothing imports another unit's internals. Cross-unit calls go through each
unit's exported server functions.

---

## 4. Verification (the gate)

This is the highest-risk and highest-value flow. It gets the most design care.

### 4.1 Flow

**Every member is approved by a human.** Decided 2026-09-16. AI reads; the
owner approves. There is no auto-approval path.

**Why.** Anthropic's vision documentation states two limits that rule out
automatic approval. Claude cannot reliably detect edited or AI-generated
images, so it cannot tell a real card from a well-edited fake. And comparing a
face to an ID photo is not a supported capability; the docs warn against
sensitive image analysis without human oversight. AI is good at *reading* a
card. It is not a fraud detector. For an app whose entire promise is that
everyone present is legal, a person makes the call.

1. Sign up with email + password and confirm the email address.
2. Attest: 21 or older, Florida resident, holder of a valid OMMU card, and
   agreement to the no-sales rule. Recorded with a timestamp.
3. Enter **patient ID** and **card expiry date** by hand.
4. **Capture the card on its own** with the in-app camera — live viewfinder,
   card-shaped guide frame, glare and blur warnings, retake. This is the
   legible close-up the fields are read from. **Not a file input;** gallery
   uploads are not accepted.
5. **Capture one live photo of the member's face holding the same card**
   beside it, with a **random challenge** chosen at capture time — for example
   "smile with your teeth showing" or "tilt your head to one side". Challenges
   use the face only: one hand holds the phone and the other holds the card,
   so a visible 3-second self-timer takes the photo (owner's phone test,
   2026-09-16). The challenge is stored with the
   submission and shown to the reviewer. It defeats re-using an old photo or a
   photo of someone else, because nobody can know the challenge in advance.
6. **Free on-device pre-checks run first:** blur, glare, a card-shaped object
   present, a face present. Junk is rejected on the phone and never costs an
   API call. The face check is MediaPipe BlazeFace, about 2.7 MB loaded on the
   face step only (measured 2026-09-16; the owner confirmed it at that size).
7. Both images POST to a server route, resized on the device to about 1000 px
   on the long edge. The route calls Claude vision with a zod-typed structured
   schema and receives **reading results and warnings, never a verdict**:
   `{ nameOnCard, patientId, expiryDate, fieldsLegible, typedFieldsMatch,
   cardVisibleInFacePhoto, challengeAppearsPerformed, concerns[] }`.
8. **Everything becomes `pending_review`.** The owner is alerted immediately
   (email in Plan 02; push once Plan 05 lands).
9. **The review screen** shows the card close-up, the face-with-card photo, the
   challenge that was requested, the typed fields, what Claude read, and any
   concerns — side by side. The reviewer compares the face in the photo to the
   photo printed on the card by eye, and chooses approve, reject, or ask for a
   retake.
10. Approval sets `status = 'verified'` and `card_expires_on`. Rejection and
    retake requests tell the member the reason in plain language.

**Honest limits of this design.** It raises the bar; it does not make fraud
impossible. A determined person could forge a physical card. The only
authoritative check is the state registry, which offers no API. The design
goal is that faking entry costs more effort than this app is worth.

**Image metadata (EXIF) is not used as evidence.** It is trivially edited or
stripped, Claude does not read it, and a photo taken through the in-app camera
has none in the first place. What actually carries weight is that capture
happens live, inside the app, with a challenge nobody could have prepared for.

### 4.2 Image retention — the honest rule

Because every submission is reviewed by a person, **the images must be kept
until that review happens.**

- Images are written to a **private Supabase bucket**, readable by
  `service_role` only, and **encrypted by the app** (AES-256-GCM) before upload,
  so the Supabase secret key alone reads ciphertext. The admin screen streams
  them decrypted through an admin-only route with `Cache-Control: no-store`.
  Storage signed URLs are not used: they would serve ciphertext. (Changed in
  Plan 02, 2026-09-16.)
- **They are deleted the moment the reviewer decides** — approve, reject or
  retake. Only the extracted fields persist (patient ID, expiry, verified-at,
  reviewer).
- **A reaper job deletes any image older than 7 days** unconditionally, even if
  it was never reviewed. An unreviewed submission then asks the member to
  capture again.
- Images are never sent anywhere except Claude, and never used for anything but
  this one check.

The screen states this plainly, and the statement is true:

> A person on our team checks your card, and your photos are deleted as soon as
> they do — within 7 days at the most.

### 4.3 Expiry handling

The real protection is **contextual, not nagging**.

- **Expiry-aware RSVP (primary control).** A member cannot request or hold a
  spot at a session dated after their card expiry. The block appears at the
  moment of RSVP: *"Your card expires Mar 4. This sesh is Mar 11. Renew to
  join."* One tap to the renew flow.
- **Host visibility.** If an already-approved guest's card will expire before
  the session date, the host gets one notice and the guest is auto-dropped
  unless renewed.
- **Reminders (deliberately few).** In-app banner from 30 days out. Push at
  7 days and at 1 day (ships with Plan 05, which builds push). **Exactly one
  email**, on the expiry date.
- **On expiry: read-only.** The member can browse and see their own history.
  They cannot RSVP, host, see any unlocked address, or message. Uploading a
  valid card restores full access immediately.

### 4.4 Abuse and cost controls

Simple and in-house. The goal is that nothing — a bug, a bot, or a determined
person — can run up the Anthropic bill.

1. **The API key exists only on the server.** Never `NEXT_PUBLIC_`, never in
   client code.
2. **Only a signed-in, attested member** can reach the verification route.
3. **Per-member limit:** 3 submissions per day. **Per-IP limit:** 10 per day.
   Both in Upstash Redis. Over either, the submission is refused whole.
4. **A global daily ceiling** for the whole app (starting value: 50 checks per
   day, configurable). Once reached, submissions are still stored and queued
   for review, but **skip the Claude call**. The reviewer reads the card by eye.
   This is the circuit breaker: even if every other control fails, the daily
   spend cannot exceed the ceiling. If Upstash is unreachable, the limiter
   fails closed for Claude (no call) and open for the member (still queued).
5. **Free on-device pre-checks** reject junk before any call (§4.1 step 6).
6. **Image size caps:** resized on device to about 1000 px; the server rejects
   anything over a hard byte limit before calling Claude.
7. **A monthly spend limit** set in the Anthropic console, outside the app
   entirely.
8. **Every call logs its token usage and computed cost** to the database, and
   the admin panel shows today's and this month's spend.

**Member action limits (issue #66, 2026-09-23).** These do not guard the bill.
They stop one account flooding a host's approvals or the feed. Both count per
member per Florida day, in Upstash, under `m4w:rsvp:member:<day>:<id>` and
`m4w:sesh:create:member:<day>:<id>`. Code: `lib/sesh/member-limits.ts`.

- **Ask to join: 30 presses a day.** The database already caps new requests at
  20 rows a day (`M4W17`), but withdrawing and asking again reuses one row, so
  that cap never trips on a loop. This one counts presses. It is set above 20
  so an ordinary member hears the database's sentence first.
- **Post a sesh: 10 a day.** The insert policy already caps a host at five
  open seshes, but posting and cancelling in a loop never trips it. Ten is
  twice five, so a host who fixes a mistake never meets it.
- Over either limit, the action is refused whole — nothing is written — and
  the banner says to try again tomorrow.
- **A press counts even when the database then refuses it** — a full sesh, a
  removed guest. That is on purpose: the limit counts what a member sends.
- **These fail open.** If Upstash is unreachable, the press goes through. The
  database caps above are still the wall; this is counting on top of them.

**Measured cost (2026-09-16).** 4 live calls on `claude-sonnet-5`, effort
`low`, a 1000×630 card image plus a 1000×750 face-with-card image, synthetic
fixtures: 3,237 input tokens each, 157–341 output tokens, **$0.0080–$0.0099
per check, mean $0.0088**. The estimate had been 1–1.5 cents. Unresized phone
photos would roughly double the input, which is why resizing is a requirement
and not an optimisation.

---

### 4.5 Authentication (decided 2026-09-16)

Magic-link sign-in is **retired**. It shipped in Plan 01 and is replaced before
any later plan builds on it.

**Why.** Meet4Weed is used as an installed PWA. On iOS, a link tapped in Mail
opens Safari, which has separate storage from the home-screen app, so the
member ends up signed in somewhere they are not. A password is typed inside the
app. Separately, some mail scanners fetch links before the person does and burn
one-time tokens.

**Contract.** Copy the `tekguyz-squid-ink` implementation (commit `c8ceb09`)
rather than re-deriving it:

- **Sign-in** is email + password and sends no email.
- **Sign-up** is email + password, with **confirm-email on**. No session until
  the address is confirmed.
- **Email carries a link for exactly two jobs:** confirming a new account and
  resetting a password.
- **Both links open `/auth/confirm`**, which calls `verifyOtp({ token_hash })`
  **only on a button POST**. A scanner's GET spends nothing, and the link works
  in any browser.
- **Link expiry is one hour.** The number shown in email copy and on screen
  must equal the project's `otp_expiry`, enforced by a test.
- **Auth email goes through Resend SMTP** with branded Warm Ink templates,
  configured in the dashboard and mirrored in `supabase/config.toml` and
  `supabase/templates/`.
- **The same response for a known and an unknown address** on sign-up and
  reset, so neither form reveals who is a member.
- **No Google provider** until the OAuth consent screen is verified.

`/auth/callback` (the magic-link code exchange) is removed once `/auth/confirm`
replaces it.

---

## 5. v1 feature scope

**In scope.**

- Email + password auth (confirm and reset by emailed link) + 21+/OMMU attestation
- Card verification, admin review queue, expiry lifecycle
- Profile: handle, avatar, bio, city, preferred strain types, consumption
  methods, vibe tags. **The avatar is a generated mark** drawn from a seed the
  member can shuffle, never a photo. A face on a profile in a discreet app is
  a separate decision, so the photo avatar moves to v2. (Amended 2026-09-23,
  Plan 04b, #59.)
- Sesh create / edit / cancel with capacity and session type
- Feed with type-chip filters and text search; map view with fuzzy circles
- **Fuzzy location:** public view shows neighbourhood + a randomized offset
  circle. Exact address, unit number, and gate code unlock **only** for
  approved RSVPs. Enforced by RLS.
- **Host-approved RSVP:** request → host approves or denies → address unlocks
- **On deck:** strain contributions (name, type) and a bring-list (snacks,
  drinks, papers). Includes an explicit, judgement-free *"bringing none"*
  option.
- **Invite links:** signed, expiring, single-sesh. The recipient still must be
  a verified member to get in.
- Notifications: in-app feed + web push for RSVP requested, RSVP approved or
  denied, sesh edited, sesh cancelled, 24h reminder, card expiry
- Installable PWA with offline shell
- Safety: report user, report sesh, block user, host kick, and the no-sales
  rule surfaced in terms and at sesh creation
- Light and dark themes, built on tokens from day one

**Out of scope for v1 — deferred deliberately.**

- v2: direct messages, crews, vibe matching, strain locker + PWA share-target
  import, **event photos** (attendees only, never public, auto-delete at 30
  days, self-removal from any photo). Added 2026-09-23 (Plan 04b, #59):
  - **Discreet mode** — a plain app name and icon on the home screen.
  - **A signed-out landing page.** v1 keeps one line on the login page.
  - **Add-to-calendar** — never carrying the address. A calendar entry is the
    address sitting on the device after the RSVP that unlocked it is gone,
    the same harm `docs/adr/0001-app-shell-caching-only.md` rules out.
  - **A photo avatar.** `profiles.avatar_url` stays in the schema, unused,
    for it.
- v3: Expo native client on the same Supabase backend
- **Never:** browser extension; any sales, cart, or dispensary ordering feature

---

## 6. Data model (shape, not final DDL)

Final types and constraints are decided during the Postgres pass; that pass
must load `supabase:supabase-postgres-best-practices`.

- `profiles` — one per auth user. Handle, avatar, bio, city, prefs, vibe tags,
  `status` (`unverified` | `pending_review` | `verified` | `expired` |
  `suspended`).
- `verifications` — patient ID, expiry date, the requested challenge, what
  Claude read and its concerns, whether the Claude call was skipped by the daily
  ceiling, token usage and cost, the reviewer's decision and reason, reviewer,
  timestamps. **No image columns** — images live in Storage.
- `verification_documents` — one row per stored image (card close-up,
  face-with-card). Storage path + `expires_at`. Row and object deleted on the
  reviewer's decision, or by the 7-day reaper.
- `seshes` — host, title, description, type, `starts_at`, capacity, status.
  Holds **both** `exact_location` and a derived `fuzzy_point` + `fuzzy_radius_m`.
- `rsvps` — sesh, member, `status` (`requested` | `approved` | `denied` |
  `cancelled` | `kicked`), timestamps. **The address-unlock predicate.**
- `contributions` — sesh, member, kind (`strain` | `item` | `none`), label,
  strain type.
- `invites` — sesh, token hash, `expires_at`, creator, use count.
- `notifications` — recipient, type, payload, read state.
- `push_subscriptions` — endpoint, keys, user agent.
- `reports` / `blocks` — reporter, target, reason, state.

### 6.1 The RLS rule that matters most

`seshes.exact_location` is never selectable in a public query. Reads go through
a view or a security-definer function that returns the exact location **only**
when the caller has an `approved` RSVP or is the host. Expired members are
excluded even if previously approved. This rule gets its own test file.

---

## 7. Design direction

**"Warm Ink", Level 2.** Approved from the side-by-side comparison.

Warm brown-black base, cream ink, brighter sage as the primary action colour,
honey-gold as the secondary. Serif display face (Fraunces) for headings against
a neutral sans (Inter) for body. Reference tokens:

| Token | Dark | Note |
| :-- | :-- | :-- |
| `bg` | `#14120E` | warm, not neutral black |
| `surface` | `#1D1913` | cards |
| `border` | `#302A20` | |
| `primary` (sage) | `#B4D982` | buttons, active nav |
| `secondary` (honey) | `#E7B968` | strain tags, accents |
| `ink` | `#F5F0E4` | |
| `ink-muted` | `#A79B87` | |

These are starting values, expressed in **OKLCH** as Tailwind v4 theme tokens.
Light mode is derived from the same token names on day one — retrofitting it
later is a rewrite. **Dark is the default.**

**Logo direction: "The Grin."** A simple round face whose eyes are two
half-closed leaves — reads as both a smile and a plant, works at favicon size,
and does not announce cannabis to someone glancing at a phone. Paired with a
Fraunces wordmark.

**Rejected and why:** the prototype's cold neon-green-on-black terminal look
(reads as a tool, tiring at night); Razer-style hot green (same); Material You
(well-made, but it is Google's brand rather than ours).

**Structural cues taken from the reference set:** big rounded cards on a dark
field, one hero card per screen, a horizontal filter chip row, a "who's going"
overlapping avatar row, fat pill CTAs, map with avatar pins, and a KYC-style
one-job-per-screen stepper with an illustration instead of a wall of text.

The **impeccable** skill drives the visual build. It is not a Tailwind default
look.

`DESIGN.md` at the repo root records Warm Ink as built, for impeccable and for
anyone adding a screen; `PRODUCT.md` holds the product truths it designs
against. Neither proposes a new look. (Added 2026-09-23, #60.)

### 7.1 Mobile

Added 2026-09-23 (Plan 04b, #59). Meet4Weed is an installed PWA used on a
phone (§4.5 chose password auth for exactly that reason), so the phone is the
design reference and wide screens adapt from it. Every route that ships is
checked at 375px, in both themes.

- **375px is the base width.** Every route works there first.
- **Tap targets are at least 44px** in both directions, including links in
  lists and icon buttons.
- **Primary actions sit within thumb reach** — in the lower part of the
  screen or directly after the last field, never only in a top corner.
- **Safe-area insets are respected** on anything pinned to an edge — the
  Frame's header and bottom tab bar in particular — so nothing hides under a
  notch or a home bar.
- **No route scrolls sideways.** A row of chips may scroll inside itself; the
  page never does.
- **The on-screen keyboard never hides the focused field or its submit
  button.**

**The accessibility bar is WCAG 2.2 AA** (owner's decision, 2026-09-23).

---

## 8. Error handling

- **Verification failures** never dead-end. Every failure names the reason
  ("the photo is blurry", "the expiry date does not match what you typed") and
  offers a retake or a path to manual review.
- **Vision API down** → the submission queues as `pending_review` rather than
  failing. The user sees "a person will check this shortly," not an error.
- **Address leaks** are treated as a security defect class, not a bug. The RLS
  test file is a release gate.
- **Push failures** are silent to the user; the in-app notification feed is the
  source of truth and push is best-effort.
- **Offline** → the PWA shell renders with cached feed data and a clear
  "you are offline" state. Writes are blocked, not queued, in v1.

---

## 9. Testing

- **Unit (vitest):** zod schemas, the expiry-aware RSVP predicate, fuzzy-point
  derivation, invite token signing and expiry.
- **RLS (vitest integration tests through the API):** the address-unlock
  matrix — host, approved guest, requested guest, denied guest, stranger,
  expired member, blocked user. Real members are created through the admin API,
  exercised through PostgREST, and deleted afterwards, following
  `supabase/tests/__tests__/profiles-rls.test.ts`. Going through the API covers
  column grants and Data API exposure, which a SQL-only test would skip. Not
  pgTAP: that needs a local stack. These files gate releases, and they skip in
  CI because CI holds no secret key.
- **Component (Testing Library):** the camera/selfie stepper, the RSVP flow,
  the on-deck editor.
- **Vision:** fixture-based. A folder of **synthetic** card images — clean,
  blurry, expired, mismatched name — asserted against expected *readings and
  concerns*, never a verdict. The model is mocked in CI; the fixtures run
  against the live API only on demand, because each run costs money. **Never
  commit a real card or a real face.**
- **Cost controls:** the per-member limit, the per-IP limit and the global daily
  ceiling each get a test proving the Claude call is skipped once exceeded.
- **Definition of done** for each plan step is a command that exits 0, with its
  output pasted. Not a claim.

---

## 10. Build order

Each step is shippable and independently verifiable.

1. **Foundation** — Next 16.3 + Tailwind v4 tokens (both themes) + Supabase
   local + CI. Proof: `npm run build`, `npm run typecheck`, `npm test` green.
2. **Auth + profiles** — attestation, profile CRUD, RLS. Built with magic link in Plan 01; **converted to password auth at the start of Plan 02**, before verification builds on it.
3. **Verification** — camera UI, vision pipeline, decision, and the admin
   verification queue (the rest of the panel lands at step 11). Retention
   reaper.
4. **Expiry lifecycle** — sweep job, read-only gate, the reminder ladder.
5. **Seshes + fuzzy location** — CRUD, feed, chips, search, map.
6. **RSVP + address unlock** — including the expiry-aware block. RLS test file.
7. **On deck + bring list.**
8. **Invites.**
9. **Notifications + push + PWA.**
10. **Safety** — report, block, kick.
11. **Admin panel** — reports queue, member and sesh lookup, overrides,
    `admin_actions` audit log.
12. **Design pass** — impeccable across every route, both themes.

Steps 2, 3, and 6 should be run at Opus 5 **High** effort. The rest are fine at
Medium.

---

## 11. Admin panel

Not optional, and not only for ID review. An email-based workflow cannot act,
and mailing a card photo would put that photo in an inbox permanently, breaking
the retention promise in §4.2. The panel is a protected route group inside the
app, gated by the **`admins` table** (read through `private.is_admin()`), not
a separate product. Decided 2026-09-16 instead of a JWT `role` claim: removing
an admin works at once, and no auth hook is needed in the dashboard.

v1 surface:

- **Verification queue** — built in Plan 02, because every member depends on
  it. Pending submissions with age; the card close-up and the face-with-card
  photo side by side; the challenge that was requested; the typed fields next
  to what Claude read; Claude's concerns. Approve / reject / request-retake,
  each with a reason. Any decision deletes the images immediately.
- **Spend** — today's and this month's Claude cost, and how close today is to
  the daily ceiling.
- **Reports queue** — reported users and reported seshes, with suspend user,
  take down sesh, and dismiss.
- **Member lookup** — status, card expiry, manual override to approve or expire.
- **Sesh lookup** — cancel a sesh on the host's behalf.

Every admin action writes an `admin_actions` audit row (actor, target, action,
reason, timestamp). This is not bureaucracy: it is the only record of why a
member was suspended if they ever ask.

---

## 12. Open items

- **Domain.** Meet4Weed is the approved name. No custom domain for now — ship
  on a `*.vercel.app` subdomain. `fancyfam.com` is not being used for this.
  `meet4weed.com` and `.app` are both available if that changes.
- **Terms and privacy copy.** Must be written before any non-owner account is
  verified, because the retention promise in §4.2 is a commitment to users.
