# Meet4Weed — rules for every session

A private social app for verified Florida OMMU medical cannabis cardholders.
Next.js 16.3 + hosted Supabase. Read `README.md` for setup and layout.

**Sources of truth, in order:** the code, then the spec
(`docs/superpowers/specs/2026-09-16-meet4weed-rebuild-design.md`), then
`README.md`. `docs/PLANS.md` says which plan covers which build-order steps
and where each one lives — read it before starting or resuming a plan. Plans in `docs/superpowers/plans/` record intent; their
`STATUS` and `AMENDED DURING EXECUTION` blocks record what actually shipped.
Read those blocks before copying any plan step.

Every rule below has already cost a bug or a decision. Each one keeps its
reason so nobody has to rediscover it.

---

## Product rules

- **The app never facilitates a sale.** No cart, no payment for cannabis, no
  dispensary ordering, no "who's selling". *Why:* it is what keeps the app
  lawful and off platform blocklists. Spec §1.
- **No member is approved by AI.** Claude reads the card and returns readings
  and concerns, never a verdict. A person approves every member. *Why:* Claude
  cannot reliably detect edited images, and face-to-ID matching is not a
  supported capability. Spec §4.1.
- **Card and face images are deleted on the reviewer's decision**, and a
  reaper deletes anything older than 7 days. EXIF is never evidence. Spec §4.2.
- **Already ruled out — do not re-propose:** Google sign-in, magic-link
  sign-in, AI auto-approval, a browser extension, React Native before v3, a
  local Docker stack, pgTAP, declarative schemas.

## Database rules

- **Every table needs `grant all on public.<table> to service_role;`** in its
  migration. *Why:* the project has "Automatically expose new tables" OFF, so
  nothing is granted to anyone by default. `service_role` bypasses row
  *policies* (BYPASSRLS), not table *privileges*, which are checked first.
  Without the grant, every server-side write fails with `42501`. Found by a
  test in Plan 01 Task 4, not by reading.
- **RLS is enabled on every table, never forced.** *Why:* `force row level
  security` applies policies to the table owner, which breaks SECURITY DEFINER
  functions owned by `postgres` — `handle_new_user()` stopped signup outright.
  It buys nothing, because `service_role` bypasses by attribute.
- **Protected columns use column-level grants, not triggers.** For example
  `grant update (handle, bio, …) on public.profiles to authenticated` leaves
  `status` and `card_expires_on` unwritable by a member. *Why:* column
  privileges are checked before RLS and cannot be talked around.
- **An UPDATE that names a non-granted column fails whole** with `42501`, even
  when the value does not change. Send only the granted columns. See
  `app/onboarding/actions.ts`.
- **Revoke EXECUTE on every new function**: `revoke execute on function … from
  public, anon` (and `authenticated` for service-only functions). *Why:*
  Postgres grants EXECUTE to PUBLIC by default, and "Automatically expose new
  tables" does not change that — a SECURITY DEFINER function left alone is
  callable with the anon key.
- **Policy helpers live in schema `private`**, which the Data API does not
  expose. `authenticated` still needs USAGE on the schema and EXECUTE on the
  helper, because a policy runs with the caller's privileges.
- Wrap `auth.uid()` as `(select auth.uid())` in policies. Index every column a
  policy reads and every foreign key. User-facing primary keys are `uuid`.
  Load `supabase:supabase-postgres-best-practices` before writing SQL.

## Migrations — no Docker

- There is **no local database**. `supabase start`, `db reset`, `db diff` and
  `test db` all need Docker, which this machine does not have.
- Write migrations **by hand** in `supabase/migrations/`, then apply them to
  the linked hosted project with `npm run db:push`. Migrations are the single
  source of truth; there is no `supabase/schemas/` and no seed.
- Hosted project ref: `uckylbulmbrsdjevhbct`.

## Tests

- **Two commands: `npm run test:unit`, then `npm run test:integration`.** Tests
  live in `__tests__/` beside what they test. `test:unit` skips `supabase/`.
  **`npm test` prints an error and exits 1 on purpose.** CI runs
  `npm run test:unit`. *Why:* a path filter cannot keep the database tests out —
  vitest matches each word as part of a path, and every test path contains
  `__tests__`, so `npx vitest run lib app components scripts __tests__` (the
  command written into the #59 tickets) runs them all at once. Issue #64 hit
  it. Use the scripts, not a hand-typed filter.
- **Go light on this machine.** While working, run only the test files you
  touched. Run `test:unit` once at the end, and `test:integration` once
  when a migration changed. Stop the dev server when the screen check is done.
- **RLS tests are vitest integration tests**, for example
  `supabase/tests/__tests__/profiles-rls.test.ts`. They create real members
  through the admin API, exercise them through PostgREST, and delete them
  afterwards. They **skip without `SUPABASE_SECRET_KEY`**, so CI never runs
  them. Run them locally before merging anything that touches a migration, and
  report whether they ran — the summary line hides a skip.
- **Run them serially — `npm run test:integration`.** Run all at once, they create
  members faster than Supabase Auth allows; unrelated suites then die in
  `beforeAll` with `Request rate limit reached`, which reads like a failure and
  is not one, and `afterAll` never deletes what they made. Re-run with
  `test:integration` before calling an integration red a real red. After any red, check
  for leftover `@meet4weed.test` accounts. The README says this too; it is here
  because this file is read first.
- **Never weaken a live security rule to prove a test fails.** Prove it
  differentially: the same statement on the same row fails for a member and
  succeeds for `service_role`.
- **Never commit a real card or a real face.** Vision fixtures are synthetic
  (`npm run fixtures:vision`). Real photos for a hand test, and the dev HTTPS
  certificate, live in `private/`, which is git-ignored. Live Claude runs
  (`VISION_LIVE=1 npm run test:vision-live`) are on demand only: about 1 cent
  per case.
- Definition of done is a command that exits 0, with its output shown.

## Secrets and cost

- **Every module that reads a server secret starts with `import "server-only";`,
  and only `lib/server-env.ts` reads secrets from the environment.** *Why:* a
  client import of a server module then fails the build instead of shipping a
  key. `lib/__tests__/secret-boundary.test.ts` holds the line.
- **Only `NEXT_PUBLIC_` keys reach the browser** — today that is the Supabase
  URL and publishable key. *Why:* the Supabase secret key bypasses every
  security rule, and the Anthropic key spends money. Never read a server key in
  a client component. Never print a key's value, not even in a log.
- The Anthropic account has a $5 monthly spend limit. The eight cost controls
  in spec §4.4 are requirements, not optimisations.
- **Every Upstash key is prefixed `m4w:`.** *Why:* the Redis database is shared
  with the TEKGUYZ Website, because the free tier allows one database.

## Auth

- **Reach signed-in pages through `GET /api/dev-login`, never the login
  form.** It signs in `dev@meet4weed.test` on the server and redirects to
  `/`, or to `?next=/path` on the same origin. It creates the account when it
  is missing, and writes a random `DEV_LOGIN_PASSWORD` into `.env.local` when
  there is none. It is a real sign-in: RLS applies. It returns 404 unless
  `NODE_ENV` is `development`. *Why:* an agent may not type a password into
  the browser pane. The account is a new, unverified member, so pages behind
  verification still send it to onboarding.

- Email + password, confirm-email on. Email carries links only to confirm and
  to reset; both open `/auth/confirm`, which spends the token only on a button
  POST. Spec §4.5 is the contract.

## Styling

- **Colour values live only in `app/globals.css`.** Components use token
  classes (`bg-surface`, `text-ink`) and never write `oklch()` or hex inline.
  *Why:* light and dark swap at runtime through the tokens; one inline colour
  breaks a theme. Dark is the default. Spec §7.
  The one exception is email templates in `supabase/templates/`, which cannot
  read CSS variables and use sRGB hex copied from the tokens.

## Next.js 16

- `middleware.ts` is now `proxy.ts`, and its export is named `proxy`.

## Agent skills

### Issue tracker

New work goes to GitHub Issues (`gh` CLI). `docs/superpowers/plans/` and `docs/superpowers/specs/` stay as they are. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root, created lazily as terms/decisions resolve. See `docs/agents/domain.md`.
