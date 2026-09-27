# Demo visitors are anonymous identities over a shared, read-only cast

Issue #39 was first specced as one shared demo account, reset each night.
**That is reversed here**, to meet `claude-config/DEMO-STANDARD.md`: with one
account, every visitor saw the last visitor's RSVPs and seshes. Each visitor
now gets their own Supabase anonymous identity, created only by pressing the
demo button (a POST, never a GET), and made a finished, verified member of the
demo realm on the server. The cast — the seeded members and seshes — is shared
and read-only. A visitor sees the cast and their own rows, never another
visitor's.

The nightly job **shifts the cast's dates in place** rather than deleting and
re-inserting the seed, so a visitor's RSVPs survive until the visitor is
deleted, seven days after arriving.

## Considered options

- **One shared account, reset nightly.** Rejected: visitors see each other,
  and one visitor can change what the next one sees.
- **A server-made throwaway email account per visitor.** Rejected: anonymous
  sign-in marks the identity as anonymous in `auth.users`, so the 7-day
  cleanup can select exactly those and can never reach a real member.

## Consequences

- **A visitor's RSVP never changes `seshes.approved_count`.** Without this,
  hundreds of visitors would push a cast sesh past its capacity for everyone.
- On entry the server gives the visitor one approved RSVP on one cast sesh, so
  the fuzzy circle resolving to an exact address is reachable in a minute.
  Other visitor RSVPs stay requested; nobody approves them.
- No notification is written to a cast member. Nobody would ever read it.
- Anonymous sign-ins must be on in the hosted project. Anyone holding the
  publishable key can then create an anonymous user directly; it is an
  unverified member who can see nothing, and the 7-day cleanup deletes it.
