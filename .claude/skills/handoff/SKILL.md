---
name: handoff
description: Gather git state, gate results and plan status for Meet4Weed, then print a paste-ready handoff block for the user's Claude.ai planning Project, ending with 2-3 next-step candidates and one recommended pick. Reads section headings and status tables, never whole documents. Use when the user asks for a handoff, a status sync, "where are we", "what's next", or says they are about to plan, spec or write a prompt in Claude.ai.
---

# Handoff to the Meet4Weed planning Project

The user plans, specs and writes prompts in a **separate Claude.ai Project**.
That Project reads this repo through the **GitHub connector**, so it already
has everything on `main`: `README.md`, the spec, the plans, the migrations.

**What sync cannot give it:** what happened in this session, what was decided,
what was rejected, what is uncommitted, and what needs a human. That is what
this block carries, and it is the only thing it should carry.

> **Adapted from `tekguyz-squid-ink`'s handoff skill on 2026-09-16.** That repo
> has a `docs/KNOWN_GAPS.md`, a `docs/ROADMAP.md` and a
> `scripts/check-docs.mjs`. **Meet4Weed has none of them.** Do not look for
> them, and do not invent their equivalents. Meet4Weed **does** have a
> `CLAUDE.md` (added 2026-09-16) holding the hard rules; it loads into every
> session, so do not re-read it for the block. The sources below are the ones
> that exist.

## Which session to run this in

**Run it in the session that did the work.** A fresh session can read
`git log`, but it did not watch anything get decided or rejected, and
rejections are the most valuable part of the block (see the rules).

- **Work happened in this chat** — run it here.
- **You only want the state** — a fresh session is fine and cheaper. Write
  **This session** as `no work in this session — state only`. Never invent
  content for it.

## The reading budget

The spec is ~6k tokens and Plan 01 is ~20k (measured 2026-09-16, chars ÷ 4). Reading them whole to write a
450-word block is the waste this skill exists to prevent.

**Hard rules.**

- **Plan status comes from one table.** `README.md` → `## Build status`:

  ```bash
  sed -n '/^## Build status/,/^---/p' README.md
  ```

  That table is the only status source. If it disagrees with `git log` — a plan
  committed as done while the table still says "Next" — report the
  disagreement in **Open now**. Do not fix it here.
- **Which plans exist:** `ls docs/superpowers/plans/`. A plan the README lists
  with no file is unwritten.
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
- **Never open a migration, a test file or a component** to write the block.
  The commit bodies already say what changed and why.
- **Never repair a doc here.** Name the drift in the block and tell the user.

## What to gather

1. **`git fetch origin` first, before any other git command.** `origin/main` is
   a cached ref; without a fetch it reports whatever this machine last saw.
2. `git log --oneline -20`, and `git log origin/main --oneline -5`.
3. `git status -sb` and `git diff --stat`, **after the fetch**. Report three
   states separately, never merged:
   - **uncommitted** — not shipped;
   - **ahead of origin** — committed here, not pushed;
   - **behind origin** — say "behind by N, run `git pull` first", and do NOT
     call the tree current.
4. **Gates, only if the block claims something is done:**
   `npm run typecheck`, `npm test`, `npm run build`. Otherwise report them as
   *not run this session*.

   `npm test` runs the database security tests only when `SUPABASE_SECRET_KEY`
   is set; **they skip silently without it, and CI never has it.** Report the
   test count *and* whether the security file ran — the summary line alone
   hides a skip.
5. **Deploy.** There is no Vercel project yet. Write `not deployed`. Once one
   exists, check it with `vercel ls` and report what it says — a push is not
   proof a build went green.

There is **no doc-check script** in this repo. Write `Checks: none exist` — never
imply one passed.

## Print the block

Print it in the response as one fenced markdown block. **Do not write it to a
file.** Keep it under roughly 450 words.

```markdown
## meet4weed — handoff <YYYY-MM-DD>

**Deployed:** <"not deployed" — or commit + one line from `vercel ls`>
**Repo:** <clean / N uncommitted> · <in sync / N ahead / N behind origin/main>
**Gates:** <typecheck / test (N passed, security tests ran|skipped) / build — or "not run this session">
**Checks:** none exist

### Plan status
- <quote the Build status table's current row(s): what is done, what is next>

### Shipped since last handoff
- <one line per commit batch, with the figure that matters>

### This session
- <3-6 bullets: what was asked, what was decided, what was rejected and why>

### Open now
- <the spec's Open items, measured this run>
- <any README-vs-git-log status disagreement>

### Next — candidates, and the one I'd pick
- <2-3 candidates, one line each, each ready now>
- **Pick:** <one, with the reason in half a sentence>

### Needs the user, not more code
- <dashboard or console settings, visual sign-off, a naming or policy call, keys to add>

### Reserved — do not brief around these blind
- <quote each rule from its source as it reads this session — see the rules below>
```

## Rules for the block

- **Every claim measured this run.** Never carry a number forward from memory
  or from an earlier handoff.
- **Rejections are load-bearing.** The planning Project writes the next brief.
  Telling it what was considered and ruled out stops it re-proposing that. This
  repo has already ruled out, among others: Google sign-in, magic-link sign-in,
  AI auto-approval of members, EXIF as evidence, a browser extension, a local
  Docker stack, and pgTAP. Name any rejection *this session* made, with its
  reason.
- **Reserved rules are quoted from their source, never from this file.** A rule
  copied into a skill stops tracking its source. The sources, as of this
  skill's writing:
  - `README.md` → `### The rule that will bite you` — the `service_role` grant.
  - `CLAUDE.md` → `## Database rules` — RLS not forced, column grants, the
    whole-UPDATE failure.
  - Spec `### 4.1 Flow` — every member approved by a human.
  - Spec `### 4.4 Abuse and cost controls` — the daily ceiling and the
    server-only key.
  - Spec `### 4.5 Authentication` — the auth contract.
  - Spec `## 1. Purpose` — the app never facilitates a sale.

  If a heading above no longer exists, say so in the block. Do not reconstruct
  the rule.
- **"Next" costs no extra reading.** Derive candidates only from the Build
  status table, the spec's Open items, and this session. If they do not support
  a pick, write `no clear next — the planning Project should choose`.
- **Never list a candidate that already shipped.** If one might exist, grep for
  its entry point first. Recommending finished work is the most expensive
  mistake this block can make.
- **No hedging.** "Plan 02 Task 3 shipped, 64 tests passing" — never "mostly
  done".
- **No attach-list.** The Project gets files from the GitHub connector. If a doc
  changed, the user clicks "Sync now". Never tell them to re-upload anything.
- **Secrets never appear in the block.** Name a variable as set or missing;
  never print its value.
