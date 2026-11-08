# Meet4Weed — rules for every session

A private social app for verified Florida OMMU medical cannabis cardholders. Next.js 16.3 + hosted Supabase. Read `README.md` for the short version, `docs/SETUP.md` for setup, `docs/ARCHITECTURE.md` for layout.

**Sources of truth, in order:** the code, then the spec (`docs/superpowers/specs/2026-09-16-meet4weed-rebuild-design.md`), then `README.md`. `docs/PLANS.md` says which plan covers which build-order steps and where each one lives — read it before starting or resuming a plan. Plans in `docs/superpowers/plans/` record intent; their `STATUS` and `AMENDED DURING EXECUTION` blocks record what actually shipped. Read those blocks before copying any plan step.

Every rule below has already cost a bug or a decision. Each one keeps its reason so nobody has to rediscover it.

---

## Product rules

- **The app never facilitates a sale.** No cart, no payment for cannabis, no dispensary ordering, no "who's selling". *Why:* it is what keeps the app lawful and off platform blocklists. Spec §1.
- **No member is approved by AI.** Claude reads the card and returns readings and concerns, never a verdict. A person approves every member. *Why:* Claude cannot reliably detect edited images, and face-to-ID matching is not a supported capability. Spec §4.1.
- **Card and face images are deleted on the reviewer's decision**, and a reaper deletes anything older than 7 days. EXIF is never evidence. Spec §4.2.
- **Already ruled out — do not re-propose:** Google sign-in, magic-link sign-in, AI auto-approval, a browser extension, React Native before v3, a local Docker stack, pgTAP, declarative schemas.

## Database

- **The database rules, the migration workflow, RLS tests and test-user sweeps are in `.claude/rules/database.md`.** It loads when Claude reads a file under `supabase/`. Read it before writing a migration, a policy or an integration test, even if it has not loaded.
- There is **no local database** (no Docker). Write migrations by hand in `supabase/migrations/` and apply them with `npm run db:push`. Hosted project ref: `uckylbulmbrsdjevhbct`.
- **An UPDATE that names a non-granted column fails whole** with `42501`, even when the value does not change. Send only the granted columns. See `app/onboarding/actions.ts`.

## Supabase account and token

- This project (`uckylbulmbrsdjevhbct`) is in the same Supabase account as `squid-ink` (one of three; checked 2026-10-04).
- The token is `SUPABASE_ACCESS_TOKEN` under `env` in `.claude/settings.local.json` (git-ignored, per laptop; token names `DELL-claude` and `ALEX-claude`). Never put it in git, `.env` or a commit. An empty value falls back to the saved login, which is the wrong account.
- **Never hand the founder a bare `supabase` command**; their terminal has no token. Hand `npm run db:push`, `npm run demo:cast` or `npm run supabase -- <command>`. They run `scripts/supabase.mjs`, which reads the token from that file (added in #128).
- When a token is new or changed, run `npm run supabase -- projects list` and check this project is in it.
- **Supabase MCP: on, read-only, this project only** (claude-config#44). Use it to look: tables, SQL reads, logs, advisors. A write is refused. Schema changes still go through a migration file and `npm run db:push`.

## Tests

- **Two commands: `npm run test:unit`, then `npm run test:integration`.** Tests live in `__tests__/` beside what they test. `test:unit` skips `supabase/`. **`npm test` prints an error and exits 1 on purpose.** CI runs `npm run test:unit`. *Why:* a path filter cannot keep the database tests out — vitest matches each word as part of a path, and every test path contains `__tests__`, so `npx vitest run lib app components scripts __tests__` (the command written into the #59 tickets) runs them all at once. Issue #64 hit it. Use the scripts, not a hand-typed filter.
- **Go light on this machine.** While working, run only the test files you touched. Run `test:unit` once at the end, and `test:integration` once when a migration changed. Stop the dev server when the screen check is done.
- **Integration tests run serially and skip without `SUPABASE_SECRET_KEY`**; report whether they ran. After any red, check for leftover `@meet4weed.test` accounts. Detail: `.claude/rules/database.md`.
- **Never commit a real card or a real face.** Vision fixtures are synthetic (`npm run fixtures:vision`). Real photos for a hand test, and the dev HTTPS certificate, live in `private/`, which is git-ignored. Live Claude runs (`VISION_LIVE=1 npm run test:vision-live`) are on demand only: about 1 cent per case.
- Definition of done is a command that exits 0, with its output shown.

## Secrets and cost

- **Every module that reads a server secret starts with `import "server-only";`, and only `lib/server-env.ts` reads secrets from the environment.** *Why:* a client import of a server module then fails the build instead of shipping a key. `lib/__tests__/secret-boundary.test.ts` holds the line.
- **Only `NEXT_PUBLIC_` keys reach the browser** — today that is the Supabase URL and publishable key. *Why:* the Supabase secret key bypasses every security rule, and the Anthropic key spends money. Never read a server key in a client component. Never print a key's value, not even in a log.
- The Anthropic account has a $5 monthly spend limit. The eight cost controls in spec §4.4 are requirements, not optimisations.
- **Every Upstash key is prefixed `m4w:`.** *Why:* the Redis database is shared with the TEKGUYZ Website, because the free tier allows one database.

## Auth

- **Reach signed-in pages through `GET /api/dev-login`, never the login form.** It signs in `dev@meet4weed.test` on the server and redirects to `/`, or to `?next=/path` on the same origin. It creates the account when it is missing, and writes a random `DEV_LOGIN_PASSWORD` into `.env.local` when there is none. It is a real sign-in: RLS applies. It returns 404 unless `NODE_ENV` is `development`. *Why:* an agent may not type a password into the browser pane. On every visit it walks the account past every gate — onboarded, a real handle, verified with a card valid for a year — so every member screen opens. `?as=admin` also makes it an admin (`?as=admin&next=/admin`); a visit without it removes the admin row. Never ask the owner to unlock a screen by hand (#90). `lib/dev-login.ts` is the one other file that reads a secret: it reads and writes `DEV_LOGIN_PASSWORD` in `.env.local`, because the route writes it there before Next reloads env.
- Email + password, confirm-email on. Email carries links only to confirm and to reset; both open `/auth/confirm`, which spends the token only on a button POST. Spec §4.5 is the contract.

## Styling

- **Colour values live only in `app/globals.css`.** Components use token classes (`bg-surface`, `text-ink`) and never write `oklch()` or hex inline. *Why:* light and dark swap at runtime through the tokens; one inline colour breaks a theme. Dark is the default. Spec §7. The one exception is email templates in `supabase/templates/`, which cannot read CSS variables and use sRGB hex copied from the tokens. The icons are the other: `npm run icons` renders them from `scripts/logo.mjs` and reads their colours from `globals.css`, so re-run it after changing a token. Never hand-edit a file it writes.

## Next.js 16

- `middleware.ts` is now `proxy.ts`, and its export is named `proxy`.

## Issues and labels

New work goes to GitHub Issues (`gh` CLI). `docs/superpowers/plans/` and `docs/superpowers/specs/` stay as they are. Labels: `ready-for-agent`, `ready-for-human`, `bug`, `enhancement`, `documentation`, `accessibility`, `question`, `invalid`, `wontfix`, and one Model label per issue (`opus-medium`, `sonnet-high`…). How to pick it is in the global rules.

Terms go in `CONTEXT.md` and decisions in `docs/adr/`, at the repo root, created lazily as they resolve.

## Status work

- Run the global `status-sync` skill.
- Never create `STATUS.md` or `docs/KNOWN_GAPS.md` here. This repo has neither on purpose.
- `## Product rules` ends with "Already ruled out — do not re-propose". Never raise an item from that list as a finding or a next step.
- There is no doc-check script. Say `Checks: none exist`. Never imply one passed.
- Never open a migration, a test file or a component for a status sync. The commit bodies say what changed.
- Name a secret as set or missing. Never print its value.
