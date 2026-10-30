---
paths:
  - "supabase/**"
  - "scripts/grant-admin.mjs"
---

# Database, migrations and integration tests

Moved out of `CLAUDE.md` on 2026-10-30 (tekguyz/meet4weed#128), unchanged in substance. Every rule here has already cost a bug or a decision.

## Database rules

- **Every table needs `grant all on public.<table> to service_role;`** in its migration. *Why:* the project has "Automatically expose new tables" OFF, so nothing is granted to anyone by default. `service_role` bypasses row *policies* (BYPASSRLS), not table *privileges*, which are checked first. Without the grant, every server-side write fails with `42501`. Found by a test in Plan 01 Task 4, not by reading.
- **RLS is enabled on every table, never forced.** *Why:* `force row level security` applies policies to the table owner, which breaks SECURITY DEFINER functions owned by `postgres` — `handle_new_user()` stopped signup outright. It buys nothing, because `service_role` bypasses by attribute.
- **Protected columns use column-level grants, not triggers.** For example `grant update (handle, bio, …) on public.profiles to authenticated` leaves `status` and `card_expires_on` unwritable by a member. *Why:* column privileges are checked before RLS and cannot be talked around.
- **Revoke EXECUTE on every new function**: `revoke execute on function … from public, anon` (and `authenticated` for service-only functions). *Why:* Postgres grants EXECUTE to PUBLIC by default, and "Automatically expose new tables" does not change that — a SECURITY DEFINER function left alone is callable with the anon key.
- **Policy helpers live in schema `private`**, which the Data API does not expose. `authenticated` still needs USAGE on the schema and EXECUTE on the helper, because a policy runs with the caller's privileges.
- Wrap `auth.uid()` as `(select auth.uid())` in policies. Index every column a policy reads and every foreign key. User-facing primary keys are `uuid`. Load `supabase:supabase-postgres-best-practices` before writing SQL.

## Migrations — no Docker

- There is **no local database**. `supabase start`, `db reset`, `db diff` and `test db` all need Docker, which this machine does not have.
- Write migrations **by hand** in `supabase/migrations/`, then apply them to the linked hosted project with `npm run db:push`. Migrations are the single source of truth; there is no `supabase/schemas/` and no seed.
- **One migration in flight at a time.** The history is linear: `db push` refuses two open branches that each carry a migration.

## RLS tests

- **RLS tests are vitest integration tests**, for example `supabase/tests/__tests__/profiles-rls.test.ts`. They create real members through the admin API, exercise them through PostgREST, and delete them afterwards. They **skip without `SUPABASE_SECRET_KEY`**, so CI never runs them. Run them locally before merging anything that touches a migration, and report whether they ran — the summary line hides a skip.
- **Run them serially — `npm run test:integration`.** Run all at once, they create members faster than Supabase Auth allows; unrelated suites then die in `beforeAll` with `Request rate limit reached`, which reads like a failure and is not one, and `afterAll` never deletes what they made. Re-run with `test:integration` before calling an integration red a real red.
- **Never weaken a live security rule to prove a test fails.** Prove it differentially: the same statement on the same row fails for a member and succeeds for `service_role`.

## Leaked test users and sweeps

- **A run that dies in setup leaks its users.** `afterAll` does not run when `beforeAll` throws. After any red integration run, say whether a sweep is needed.
- **Never sweep the whole `@meet4weed.test` domain.** Demo users and dev-login users (`dev-`) share it. Select first, read the list, then delete.
- **New integration test emails start with `it-`**, so one sweep finds them:

  ```sql
  select email from auth.users where email like 'it-%@meet4weed.test';
  delete from auth.users where email like 'it-%@meet4weed.test';
  ```

- **Most suites here do not use `it-` yet.** They name users by suite (`rls-`, `reaper-`, `rsvp-`, `push-` and more), so the `it-` sweep misses them. Until they move, delete by those suite prefixes only, after the select.
- **A reaper or sweep that deletes across the project lives in ONE test file.** Files run in parallel; two files sweeping delete each other's fixtures.
