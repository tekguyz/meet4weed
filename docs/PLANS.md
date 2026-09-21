# Plans — what each one covers, and where it lives

The spec's build order (§10 of
`docs/superpowers/specs/2026-09-16-meet4weed-rebuild-design.md`) has twelve
steps. A **plan** is one or more of those steps, taken in order.

This file is the index. It exists because Plan 03 moved from a file to GitHub
Issues and nothing recorded the change — a new session could find Plans 01 and
02 on disk, see no Plan 03, and have no idea where to look.

## Where a plan lives

| Plan | Build-order steps | Lives in | Status |
| :-- | :-- | :-- | :-- |
| 01 | 1–2 — foundation, auth, profiles | `docs/superpowers/plans/2026-09-16-01-foundation-auth-profiles.md` | Done |
| 02 | 3–4 — verification, review queue, expiry | `docs/superpowers/plans/2026-09-16-02-verification-expiry.md` | Done |
| 03 | 5–6 — seshes, map, RSVP, address unlock | GitHub issue #2, with #3–#10 as its tickets | Done 2026-09-20 |
| 04 | 7–8 — on deck and bring list, invites | GitHub issue #23, with #25–#32 as its tickets | Done 2026-09-21 |
| 05 | 9 — notifications, web push, PWA | GitHub Issues | Not started |
| 06 | 10 — safety: report, block, kick | GitHub Issues | Not started |
| 07 | 11 — admin panel beyond the verification queue | GitHub Issues | Not started |
| 08 | 12 — the impeccable design pass, every route, both themes | GitHub Issues | Not started |

Plans 04 onward are **provisional groupings**. Fold two steps together or split
one if it reads better at the time; update the table when you do.

## New plans go to GitHub Issues

`docs/superpowers/plans/` is history. It is kept because Plans 01 and 02 record
what actually shipped, and their `STATUS` and `AMENDED DURING EXECUTION` blocks
are still the truth about those steps. Nothing new is added there.

See `docs/agents/issue-tracker.md` for the conventions.

## Starting the next plan

In a fresh session, one command:

```
/mattpocock-skills:to-spec
```

…followed by a short paragraph saying which build-order steps the plan covers
and anything that has changed since this table was written. The skill reads the
repo itself — `CLAUDE.md`, `CONTEXT.md`, the spec, the closed issues — so the
paragraph only has to supply what the repo cannot know.

Then, in order:

1. `/mattpocock-skills:grilling` on the spec, before it is final. Plan 03's
   grilling found a fuzzy-circle design that could be averaged back to a
   member's house. It earns its turn.
2. `/mattpocock-skills:to-tickets` to break it into child issues.
3. `/mattpocock-skills:tdd` per ticket — one branch, one PR each.

`to-spec` and `to-tickets` can only be typed by the owner; they refuse to be
invoked by a model.

## One hard-won rule

**Migration tickets land one at a time.** The Supabase project is shared and
its migration history is linear, so two branches each carrying a migration
cannot be open together — `npm run db:push` refuses outright. Stack them, or
merge one before starting the next. This cost an hour in Plan 03.
