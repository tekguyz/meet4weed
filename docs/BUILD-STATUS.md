# Build status and history

Moved from the old README.

> **Status: rebuild in progress, four plans of eight shipped.** Password
> sign-in, attestation, member profiles, card verification with an owner review
> queue and the expiry lifecycle are proven end to end on a real phone with a
> real card (2026-09-18) and deployed to Vercel (2026-09-19). Seshes, the map,
> RSVPs and the address unlock followed (2026-09-20), then the on-deck bring
> list, unlisted seshes, invite links and the 7-day retention wipe
> (2026-09-21).
> Notifications, safety tools, the admin panel and the design pass are
> designed but not built. See [Build status](#build-status).

## Build status

The rebuild follows one spec and nine plans. [`docs/PLANS.md`](docs/PLANS.md)
is the index that says where each one lives; this table is the short version.

| Plan | Builds | Status |
| :-- | :-- | :-- |
| 01 | Scaffold, design tokens, auth, profiles | **Done** |
| 02 | Password auth, card verification with owner review queue, cost caps, expiry lifecycle | **Done** |
| 03 | Seshes, map, RSVP, address unlock | **Done** 2026-09-20 |
| 04 | On deck and bring list, unlisted seshes, invites, retention | **Done** 2026-09-21 |
| 04b | App foundations: the Frame, missing routes, settings, delete account, mobile fit | **Done** 2026-09-25 |
| 05 | Notifications, web push, installable PWA | **Done** 2026-09-26 |
| 06 | Safety: report, block, kick | Next — unblocked |
| 07 | Admin panel beyond the verification queue | — |
| 08 | The design pass, every route, both themes | — |

- **Spec:** [`docs/superpowers/specs/2026-09-16-meet4weed-rebuild-design.md`](docs/superpowers/specs/2026-09-16-meet4weed-rebuild-design.md)
- **Plan index:** [`docs/PLANS.md`](docs/PLANS.md)
- **Plans 01–02:** [`docs/superpowers/plans/`](docs/superpowers/plans/), with the
  `STATUS` and `AMENDED DURING EXECUTION` blocks that record what actually
  shipped.
- **Plans 03 onward:** GitHub Issues. A plan is a parent issue and its tickets
  are children.

---

## History

This repository previously held a React + Vite + Netlify prototype built in
Google AI Studio. It ran entirely on mock data, with no database and no real
authentication. It was removed in the rebuild; its ideas carried into the spec,
its code did not. It is still in git history before commit `04381a5`.
