# RSVPs outlive the seven-day forget

Seven days after a sesh starts, `sesh_address_reaper()` deletes its address,
its bring list, its invites and its invite claims (#10, #32). **It does not
delete RSVPs, on purpose.** Issue #42 asked why; this is the answer.

What survives a sesh after seven days is a title, a date, an area name, a
fuzzy circle and who was approved. No street, no gate code, no exact point.

An RSVP is kept because three things lean on it:

- **The member's own history.** `/seshes/mine` reads RSVPs. Deleting them
  would take "the seshes I went to" off a member's own account.
- **The host's judgement.** A host deciding on a request may want to know the
  person came before.
- **Safety (Plan 06).** A kick is an RSVP status. Report and block need a
  trail; a row gone after seven days leaves a repeat problem none.

The address unlock (`private.can_see_address()`) reads RSVP status, but an old
approved RSVP opens nothing: the guest branch closes twelve hours after the
start, and the address itself is deleted at seven days.

## Considered options

- **Delete RSVPs on the same seven days.** One rule, but a member's history
  shrinks to the seshes they hosted, and a kick leaves no trail. Rejected.
- **Keep the row, strip what identifies it.** A half-deleted row is still a
  row somebody has to reason about. Rejected.

## Consequences

- An invite claim is forgotten at seven days; the RSVP from the same evening
  is not. That asymmetry is deliberate: the claim only says how somebody got
  in, and the RSVP says they were a guest.
- If a later plan deletes a member's history on request, it deletes their
  RSVPs with the account (delete account already does, by cascade).
