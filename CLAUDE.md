# Meet4Weed — rules for every session

A private social app for verified Florida OMMU medical cannabis cardholders.
Next.js 16.3 + hosted Supabase. Read `README.md` for setup and layout.

**Sources of truth, in order:** the code, then the spec
(`docs/superpowers/specs/2026-09-16-meet4weed-rebuild-design.md`), then
`README.md`. Plans in `docs/superpowers/plans/` record intent; their
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

- `npm test` runs vitest. Tests live in `__tests__/` beside what they test.
- **RLS tests are vitest integration tests**, for example
  `supabase/tests/__tests__/profiles-rls.test.ts`. They create real members
  through the admin API, exercise them through PostgREST, and delete them
  afterwards. They **skip without `SUPABASE_SECRET_KEY`**, so CI never runs
  them. Run them locally before merging anything that touches a migration, and
  report whether they ran — the summary line hides a skip.
- **Never weaken a live security rule to prove a test fails.** Prove it
  differentially: the same statement on the same row fails for a member and
  succeeds for `service_role`.
- **Never commit a real card or a real face.** Vision fixtures are synthetic.
  Live Claude runs are on demand only, because each costs money.
- Definition of done is a command that exits 0, with its output shown.

## Secrets and cost

- **Only `NEXT_PUBLIC_` keys reach the browser** — today that is the Supabase
  URL and publishable key. *Why:* the Supabase secret key bypasses every
  security rule, and the Anthropic key spends money. Never read a server key in
  a client component. Never print a key's value, not even in a log.
- The Anthropic account has a $5 monthly spend limit. The eight cost controls
  in spec §4.4 are requirements, not optimisations.
- **Every Upstash key is prefixed `m4w:`.** *Why:* the Redis database is shared
  with the TEKGUYZ Website, because the free tier allows one database.

## Auth

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
