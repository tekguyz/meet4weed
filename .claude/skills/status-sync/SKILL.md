---
name: status-sync
description: Audit Meet4Weed's recorded status against the real repo state — git state, gate results, the README build table, the spec's open items — and report the drift, ending with 2-3 next-step candidates and one recommended pick. Reads section headings and status tables, never whole documents. Use when the user asks for a status sync, "where are we", "what's next", or says they are about to plan or spec against this repo.
---

# Status sync for Meet4Weed

This repo records its status in three places: `README.md` → `## Build status`
(which plan is done and which is next), `docs/PLANS.md` (where each plan lives),
and `git log` (what happened). When one of them is stale, anything planned
against it works from work that already closed.

This skill audits those records against the repo's real state and reports the
drift. **That is the whole job.** It prints no paste block and produces no
message for another tool. Nothing is pasted into a Claude.ai Project any more —
see `C:\Projects\tekguyz-one\docs\adr\0001-retire-the-claude-ai-project-loop.md`.

**There is deliberately no `STATUS.md` and no `docs/KNOWN_GAPS.md` here, and
this skill must never create one.** Do not look for them and do not invent their
equivalents.

> **Adapted from `tekguyz-squid-ink`'s skill on 2026-09-16.** That repo has a
> `docs/KNOWN_GAPS.md`, a `docs/ROADMAP.md` and a `scripts/check-docs.mjs`.
> Meet4Weed has none of them. Meet4Weed **does** have a `CLAUDE.md` holding the
> hard rules; it loads into every session, so read it from what you have rather
> than opening the file. The sources below are the ones that exist.

## Which session to run this in

**Run it in the session that did the work.** A fresh session can read
`git log`, but it did not watch anything get decided or rejected, and
rejections are the most valuable part of the report (see the rules).

- **Work happened in this chat** — run it here.
- **You only want the state** — a fresh session is fine and cheaper. Say
  `no work in this session — state only`. Never invent content for it.

## The reading budget

The spec is ~6k tokens and Plan 01 is ~20k (measured 2026-09-16, chars ÷ 4).
Reading them whole to write a short report is the waste this skill exists to
prevent.

**Hard rules.**

- **Plan status comes from one table.** `README.md` → `## Build status`:

  ```bash
  sed -n '/^## Build status/,/^---/p' README.md
  ```

  That table is the only status source. If it disagrees with `git log` — a plan
  committed as done while the table still says "Next" — report the
  disagreement under open work. Do not fix it here.
- **Which plans exist:** `ls docs/superpowers/plans/`, and `docs/PLANS.md` for
  the ones that live in GitHub Issues. A plan the README lists with no file and
  no issue is unwritten.
- **Open items come from the spec's own section**, by heading:

  ```bash
  grep -n "^#\{2,3\} " docs/superpowers/specs/2026-09-16-meet4weed-rebuild-design.md
  ```

  then `sed -n` only the `Open items` section.
- **Execution changes are in amendment blocks.** Plans are amended in place
  when execution departs from them:

  ```bash
  grep -rn "AMENDED DURING EXECUTION" docs/superpowers/plans/
  ```

  Open only the amendments this session added.
- **Never open a migration, a test file or a component** to write the report.
  The commit bodies already say what changed and why.

## The audit

**Measure, never infer.** Every figure comes from a command run this session.

1. **`git fetch origin` first, before any other git command.** `origin/main` is
   a **cached local ref**; without a fetch it holds whatever the last fetch on
   THIS machine saw. The user works from two laptops against one repo, so on the
   laptop that did not do the work `git status -sb` reports "in sync with
   origin/main" while the remote is many commits ahead.
2. `git log --oneline -20`, and `git log origin/main --oneline -5`.
3. `git status -sb` and `git diff --stat`, **after the fetch**. Report three
   states separately, never merged:
   - **uncommitted** — not shipped;
   - **ahead of origin** — committed here, not pushed;
   - **behind origin** — say "behind by N, run `git pull` first", and do NOT
     call the tree current.
4. **Gates, only if the report claims something is done:**
   `npm run typecheck`, `npm test`, `npm run build`. Otherwise report them as
   *not run this session*.

   `npm test` runs the database security tests only when `SUPABASE_SECRET_KEY`
   is set; **they skip silently without it, and CI never has it.** Report the
   test count *and* whether the security file ran — the summary line alone
   hides a skip.
5. **Deploy.** There is no Vercel project yet. Say `not deployed`. Once one
   exists, check it with `vercel ls` and report what it says — a push is not
   proof a build went green.

There is **no doc-check script** in this repo. Say `Checks: none exist` — never
imply one passed.

## Exclusion pass — the ruled-out list. Every run.

`CLAUDE.md` → `## Product rules` ends with **"Already ruled out — do not
re-propose"**. Everything named there is **struck from this audit's findings**.
No item from that list may be raised as a finding, listed as open work, offered
as a next-step candidate, or routed to the user, no matter which check surfaced
it.

A ruled-out item is not deferred work and is not partially resolved. It was
considered and closed permanently. Surfacing is expected — the plans and the
spec's own history will keep raising these. **Reporting is the bug.** Apply the
filter before you write the report, not while writing it: by then the item is
only prose and reads exactly like a real one.

Nothing mechanical guards this. The list is the only defence. If the user
changes their mind they will say so and delete the entry; that is the only way
an item comes back.

## The repair

**Never repair a doc here.** This repo's policy is report-only: name the drift
and tell the user. Nothing is edited and nothing is committed by this skill,
even when a stale line is obvious and the fix is one word. A doc edit belongs to
the ticket that caused the drift, so it lands with the change that made it
wrong.

If the records were already accurate, say so plainly and change nothing.

## Reporting back

A short answer in the response. No file, no fenced block, no template.

- Say what the audit found, and never more than that. When it found no drift,
  say `none`.
- Every claim measured this run. Never carry a number forward from memory or
  from an earlier sync.
- **No hedging.** "Plan 02 Task 3 shipped, 64 tests passing" — never "mostly
  done".
- **Rejections are load-bearing.** Name any rejection *this session* made, with
  its reason, so the next session does not re-propose it. Items already on the
  ruled-out list are excluded — see the exclusion pass.
- **"Next" costs no extra reading.** Derive candidates only from the Build
  status table, `docs/PLANS.md`, the spec's Open items, and this session. Give
  2–3 candidates, each ready now, and one pick with the reason in half a
  sentence. If they do not support a pick, say `no clear next — the user should
  choose`.
- **Never list a candidate that already shipped.** If one might exist, grep for
  its entry point first. Recommending finished work is the most expensive
  mistake this report can make.
- **Reserved rules are quoted from their source, never from this file.** A rule
  copied into a skill stops tracking its source. Quote each one as it reads this
  session. The sources, as of this skill's writing:
  - `README.md` → `### The rule that will bite you` — the `service_role` grant.
  - `CLAUDE.md` → `## Database rules` — RLS not forced, column grants, the
    whole-UPDATE failure.
  - Spec `### 4.1 Flow` — every member approved by a human.
  - Spec `### 4.4 Abuse and cost controls` — the daily ceiling and the
    server-only key.
  - Spec `### 4.5 Authentication` — the auth contract.
  - Spec `## 1. Purpose` — the app never facilitates a sale.

  If a heading above no longer exists, say so. Do not reconstruct the rule.
- Name anything that needs the user, not more code: a dashboard or console
  setting, visual sign-off, a naming or policy call, keys to add.
- **Secrets never appear in the report.** Name a variable as set or missing;
  never print its value.
