# Product

<!-- impeccable:product-schema 1 -->

Product truth only. The look lives in `DESIGN.md`. Where this file and the
spec (`docs/superpowers/specs/2026-09-16-meet4weed-rebuild-design.md`)
disagree, the spec wins and this file is out of date.

## Platform

web

A Next.js app installed to the home screen as a PWA and used mostly on a
phone. Mobile web, not native. A native client is v3 (spec §5).

## Users

**Verified Florida OMMU medical cannabis cardholders, 21 or older.** They open
the app on their phone to find a small private gathering (a "sesh") at
someone's home, or to host one. Confirmed with the owner, 2026-09-23.

Launch is small and private: friends and a closed group first, not a public
marketplace (spec §1.2).

Two other roles exist:

- **Host** — a member who created a sesh. Approves or denies each guest by
  hand.
- **Admin (the owner)** — reviews every card, watches the Claude spend, and
  later handles reports. Uses the same app, inside `/admin`.

A **signed-out stranger** meets the app only through a shared link or the
login page. They cannot see any member, sesh or address.

## Product Purpose

Florida law lets qualified patients consume at a private residence. Meet4Weed
exists so that **everyone in the room is one**: every member holds a valid,
unexpired OMMU card, and nobody else gets in.

On top of that gate it is a social layer: create a sesh, browse a feed and a
map of fuzzy circles, request a spot, get approved, see the address, say what
you are bringing.

Success is a member walking into a stranger's home knowing that every person
there was checked by a human, and that nobody outside the guest list knows the
address.

## Positioning

The gate is the product. A person approves every member from a live,
challenge-based card and face capture. Addresses stay hidden behind a fuzzy
circle until the host approves you. A neighbouring event app could copy the
feed; it could not truthfully claim either of those.

## Operating Context

- **On a phone, often at night**, often in a shared or semi-public place.
  Anyone glancing at the screen or a lock-screen push must not learn who is
  meeting whom, or where (ADR 0002).
- **Verification is a one-job-per-screen camera flow** on the phone: card
  close-up, then face with card and a random challenge, with a 3-second
  self-timer. No gallery upload (spec §4.1).
- **Hosts approve guests one at a time**, from their own sesh page.
- **The owner reviews cards** on the admin queue and decides by eye.

## Capabilities and Constraints

Product truths. Each one is load-bearing; do not design around them.

- **The app never facilitates a sale.** No cart, no payment for cannabis, no
  dispensary ordering, no "who's selling". The no-sales rule is shown in the
  terms and at sesh creation. It keeps the app lawful and off platform
  blocklists (spec §1).
- **A person approves every member.** Claude reads the card and lists
  concerns. It never returns a verdict. No screen may imply that AI approved
  someone (spec §4.1).
- **Discretion is a feature, not a setting.** Exact addresses unlock only for
  approved guests, within 12 hours of the start, while their card is valid.
  The public sees a fuzzy circle. Push text names no member and no sesh. A
  profile never lists seshes. The service worker caches no data. After seven
  days the app forgets the address and the bring list.
- **Card and face photos are deleted on the reviewer's decision**, and within
  7 days at the most. Screens say exactly that, and it is true (spec §4.2).
- **Expired members are read-only, not shut out.** They can browse but not
  RSVP, host or see an address.
- **Tabs a member cannot use are hidden, not greyed out.**
- **Avatars are generated, never a photo** in v1.
- **Words.** "Sesh", never "session". "On deck", never "inventory" or "stash".
  The full glossary is `CONTEXT.md`.
- **Already ruled out:** see the list in `CLAUDE.md` (Product rules). Do not
  re-propose any of it.
- **Deferred to v2:** direct messages, crews, discreet mode, a signed-out
  landing page, add-to-calendar, a photo avatar, event photos.

## Brand Commitments

- **Name:** Meet4Weed. **Tagline in code:** "A private circle for verified
  Florida patients." (`lib/env.ts`).
- **Voice:** plain, calm and honest. Name the reason when something fails,
  and always offer the next step (spec §8). Never hype, never wink at
  cannabis culture.
- **Logo direction:** "The Grin" — a round face whose eyes are two
  half-closed leaves, with a Fraunces wordmark (spec §7). Not drawn yet.

## Evidence on Hand

- Reference screenshots in `refs/` (event UI kit, ID-verification onboarding,
  meet-up, dark-mode app, member area). Structural cues only.
- No testimonials, no member count, no press. Do not invent any.
- Terms, privacy, help and community-rules copy is **not written**. The owner
  writes it. Routes ship with placeholder copy clearly marked as placeholder.

## Product Principles

1. **The gate comes first.** When a design choice trades trust for
   convenience, trust wins.
2. **Hide by default, reveal by approval.** Nothing about who or where is
   shown until a person has said yes.
3. **Never a dead end.** Every state — pending, rejected, expired, offline,
   404 — says where you stand and what to do next.
4. **Say only what is true.** Retention, approval and privacy statements on
   screen must match what the code does.
5. **Phone first.** The installed PWA on a phone is the real product; wide
   screens adapt from it.

## Accessibility & Inclusion

**WCAG 2.2 AA.** Confirmed with the owner, 2026-09-23. Tap targets are at
least 44px. Both themes meet contrast. Reduced motion is honoured. Feedback is
announced politely to screen readers. The spec's Mobile section carries the
phone rules.
