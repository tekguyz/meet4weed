# AGENTS.md

Read `CLAUDE.md` first. It holds this repo's rules for every agent, not only Claude. The global rules every repo shares are in `CLAUDE.md` of the claude-config repo (`github.com/tekguyz/claude-config`).

## Rules that apply to you

- **Never run `npm test`.** It fails on purpose. Run `npm run test:unit` before a commit. Run `npm run test:integration` (serial, against the hosted Supabase project) only when a change touches the database, auth, RLS or a migration. Run only the tests for the files you changed while working.
- **No secrets in git.** No token or key in a commit, a committed `.env` or a commit message.
- **Close issues from the PR.** The PR body says `closes #N` when it finishes issue N, `refs #N` when it is only part of it.
- **Work left over** goes in a GitHub issue in this repo. Say its number.

## Model labels on tickets

Each issue has one label that says how hard it is: `opus-*` means use your strongest model, `sonnet-*` your middle one, `haiku-*` your fastest. The part after the dash (`low`, `medium`, `high`) is the effort or reasoning setting; use your own closest one. A ticket that needs a plan first says so in its first line.

## What only Claude Code has

Hooks and Claude's memory notes are Claude Code features. You do not need them and should not look for them. The rules they carry are written in `CLAUDE.md`.
