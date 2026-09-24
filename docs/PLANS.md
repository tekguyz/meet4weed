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
| 04b | none — app foundations: the Frame, missing routes, settings, mobile | GitHub issue #59 | Grilled and spec'd 2026-09-22. Setup (#60) done 2026-09-23: `PRODUCT.md`, `DESIGN.md`, the Frame/Me shape brief in `.impeccable/surfaces/route-me.md`, spec §5, §7.1 Mobile and the v2 list. The Frame and `/` (#62), the shared banner (#61), framework pages (#63) and the Profile page with its select-policy migration (#64) and Me and settings (#65) and the RSVP and sesh-create limits (#66) and Open in Maps, empty states and the desktop hand-off (#67) done 2026-09-23. Help, terms, privacy and rules with the terms-version migration (#68) and the Avatar with Shuffle and its seed migration (#69) and the handle change with its 30-day lock and migration (#70) and Delete account with its spend-ledger migration (#71) done 2026-09-24. Next: #75, then #72 last. The rest not built. **Runs before 05** |
| 05 | 9 — notifications, web push, PWA | GitHub issue #48 | Grilled and spec'd 2026-09-22; not built. Waits for 04b (#59) |
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

### 2026-09-21 — `docs/superpowers/plans/` was kept on purpose

Job 3 of `C:\Projects\tekguyz-one\docs\WORKFLOW-PLAN-2026-09-20.md` also says to
delete or archive the leftover Superpowers plan files that its §1.3 lists per
repo. **§1.3 mis-listed this repo's two plan files as leftovers.** They are not.
`CLAUDE.md` § Agent skills → Issue tracker says `docs/superpowers/plans/` and
`docs/superpowers/specs/` "stay as they are", and the section above says the
folder "is kept because Plans 01 and 02 record what actually shipped".
`README.md` links both files as that record.

**Nothing under `docs/superpowers/` was deleted, archived or moved.** The survey
behind §1.3 never read this repo's `CLAUDE.md`. The thing that needs correcting
is §1.3 in `tekguyz-one`, not this repo — and that correction belongs to a
session started in that repo.

## Starting the next plan

In a fresh session, three commands, **in this order and in that one window**:

```
/grill-with-docs
/to-spec
/to-tickets
```

**Never `/clear` or compact between them.** Each one builds on what the last
one settled, and a cleared window loses it.

The grilling comes **first**, on the idea, before any spec is written. This
file used to say the opposite — spec first, grill the spec after — which
contradicted the global `CLAUDE.md` workflow. The global file wins; corrected
2026-09-22.

Grilling is not optional on a real plan. Plan 03's grilling found a
fuzzy-circle design that could be averaged back to a member's house. It earns
its turn.

With `/grill-with-docs`, give a short paragraph saying which build-order steps
the plan covers and anything that has changed since this table was written. The
skills read the repo themselves — `CLAUDE.md`, `CONTEXT.md`, the spec, the
closed issues — so the paragraph only has to supply what the repo cannot know.

Then `/clear`, and `/implement` one ticket at a time. `/implement` runs `/tdd`
inside it and closes with `/code-review`; neither is typed by hand.

`to-spec` and `to-tickets` can only be typed by the owner; they refuse to be
invoked by a model.

**Not every job is a plan.** The three-command flow is for a build-order step
that is still one line in the spec. A bug goes to `/diagnosing-bugs`, work you
did not create goes to `/triage`, and a small obvious fix goes straight to
`/implement`. Global `CLAUDE.md` § Workflow lists the rest.

**Skip `/to-tickets` when the plan turns out to be one feature.** One spec
issue with named passes beats a pile of thin tickets that each need their own
branch, PR and review. The grilling is what tells you which one it is.

## One hard-won rule

**Migration tickets land one at a time.** The Supabase project is shared and
its migration history is linear, so two branches each carrying a migration
cannot be open together — `npm run db:push` refuses outright. Stack them, or
merge one before starting the next. This cost an hour in Plan 03.
