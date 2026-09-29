# Tests

Moved from the old README.

## Tests

Two commands, never one:

```bash
npm run test:unit
npm run test:integration
```

`test:unit` skips `supabase/`. `test:integration` runs only `supabase/`, one
file at a time. `npm test` prints an error and exits 1, so nobody runs both
halves at once by habit. CI runs `npm run test:unit`.

*Why two:* the database tests make real accounts on the hosted project. Run
all at once, they sign in faster than Supabase allows, suites die in
`beforeAll`, and `afterAll` never deletes what they made. A path filter does
not keep them out: vitest matches each word as part of a path, so
`npx vitest run lib app components __tests__` still runs them, because every
test path contains `__tests__`. Issue #64 hit exactly that and left 10 junk
accounts.

While working, run only the test files you touched. Run `test:unit` once at the
end, and `test:integration` once when a migration changed.

The security tests run against the hosted project and delete what they create:

- `supabase/tests/__tests__/profiles-rls.test.ts` — who can read and write profiles.
- `supabase/tests/__tests__/verification-rls.test.ts` — who can read a submission, decide one, or call the service-only functions.
- `supabase/tests/__tests__/verification-store.test.ts` — stored photos are ciphertext.
- `supabase/tests/__tests__/verification-reaper.test.ts` — the 7-day deletion.
- `supabase/tests/__tests__/sesh-rls.test.ts` — who can post, edit and read a sesh.
- `supabase/tests/__tests__/sesh-feed-rls.test.ts` — what the feed and the map return.
- `supabase/tests/__tests__/sesh-fuzz.test.ts` — the circle is derived, and the exact point never leaves.
- `supabase/tests/__tests__/sesh-address-unlock.test.ts` — the unlock matrix. Who gets a street address, and when it is taken back.
- `supabase/tests/__tests__/sesh-reaper.test.ts` — the whole 7-day wipe: the address, the bring list, the invites and the invite claims. **One file on purpose.** The reaper deletes across the whole project in a single call, and vitest runs files in parallel, so two files calling it delete each other's fixtures.
- `supabase/tests/__tests__/rsvp-rls.test.ts` — asking, withdrawing, and the host deciding.
- `supabase/tests/__tests__/on-deck-rls.test.ts` — who can read and write the bring list.
- `supabase/tests/__tests__/sesh-unlisted-rls.test.ts` — an unlisted sesh is absent from the feed, the map and search.
- `supabase/tests/__tests__/invite-rls.test.ts` — minting, redeeming, and the whole unlock matrix re-asserted for somebody holding an invite.
- `supabase/tests/__tests__/sesh-list-columns.test.ts` — the column list `lib/sesh/queries.ts` actually sends is readable. A missing column grant fails the WHOLE query with `42501`, and those functions end `return (data ?? [])`, so it looks exactly like an empty app. This is the guard that makes it loud.

They **skip themselves** when `SUPABASE_SECRET_KEY` is not set. CI has no
secret, so **CI does not run the security tests.** Run them locally before
merging anything that touches a migration, and **check they ran** — the
summary line hides a skip.

Run them **serially**, which is what `test:integration` does:

```bash
npm run test:integration
```

In parallel they create members faster than Supabase Auth allows and a suite
or two dies with `Request rate limit reached`, which reads like a failure and
is not one.

`lib/verification/__tests__/vision.live.test.ts` calls the real Claude API and
runs only with `VISION_LIVE=1`. Every other vision test uses a mocked client.
