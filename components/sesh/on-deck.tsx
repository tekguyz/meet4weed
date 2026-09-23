"use client";

import { useActionState } from "react";
import { addContribution, removeContribution } from "@/app/seshes/on-deck-actions";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/forms/action-state";
import { CONTRIBUTION_LABEL_MAX, BRINGING_NONE } from "@/lib/sesh/on-deck";
import { STRAIN_TYPES } from "@/lib/profiles/schema";
import type { ContributionRow } from "@/lib/sesh/queries";

/**
 * The on-deck panel — what people are bringing.
 *
 * IT TAKES WHAT TO RENDER AND NO IDENTITY. There is no approval flag here, no
 * member id and no RSVP status, exactly as in `AddressPanel`. There cannot be
 * one: `contributions_select` returns no rows at all to anybody the host has
 * not approved, so an empty list is already the answer. The empty card says
 * both true things — nobody has spoken yet, and the list opens on approval —
 * because the screen is not told which one it is looking at, and must not
 * ask. See components/sesh/__tests__/on-deck.test.tsx.
 *
 * Three answers, rendered as equals. A member has not said yet, is bringing
 * none, or is bringing things. "Bringing none" is a row like any other: same
 * card, same size, same place in the order, never a warning colour and never
 * pushed down the list. Postgres keeps the last two exclusive with a trigger
 * that fires both ways, so one press switches either way and nobody is ever
 * shown as both.
 *
 * No totals, no per-person counts, no ranking — any of those turns a social
 * list into a scoreboard, and a count is what would make "bringing none" a
 * number that goes down. For the same reason none of this reaches a feed card.
 */
type Props = {
  seshId: string;
  rows: ContributionRow[];
};

/** One class list for every card, so the three answers weigh the same. */
const CARD = "flex flex-col gap-2 rounded-card bg-surface p-4";
const ANSWER = "text-sm text-ink";

function Result({ state }: { state: ActionState | null }) {
  if (!state) return null;
  return (
    <Banner tone={state.ok ? "success" : "danger"}>{state.message}</Banner>
  );
}

function ContributionCard({ seshId, row }: { seshId: string; row: ContributionRow }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    removeContribution,
    null,
  );

  return (
    <li className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={ANSWER}>{row.kind === "none" ? BRINGING_NONE : row.label}</span>
        {row.strainType ? (
          <span className="shrink-0 rounded-control bg-surface-2 px-2 py-1 text-xs text-ink-muted">
            {row.strainType}
          </span>
        ) : null}
      </div>
      <span className="text-sm text-ink-muted">@{row.handle}</span>
      {/* Offered to everyone. The database refuses the ones it should, and
          the action turns that refusal into a sentence. */}
      <form action={action}>
        <input type="hidden" name="seshId" value={seshId} readOnly />
        <input type="hidden" name="contributionId" value={row.id} readOnly />
        <button
          type="submit"
          disabled={pending}
          className="self-start text-sm text-ink-muted underline disabled:opacity-50"
        >
          {pending ? "Removing…" : "Remove"}
        </button>
      </form>
      <Result state={state} />
    </li>
  );
}

/** Adding a strain or an item. Either one clears that member's "bringing
 *  none" row in Postgres, so this is the way back from it — one press. */
function AddForm({ seshId }: { seshId: string }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    addContribution,
    null,
  );

  return (
    <form action={action} className={CARD}>
      <input type="hidden" name="seshId" value={seshId} readOnly />

      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        What are you bringing?
        <input
          name="label"
          type="text"
          required
          maxLength={CONTRIBUTION_LABEL_MAX}
          placeholder="Blue Dream, papers, snacks…"
          className="rounded-control bg-surface-2 px-3 py-2 text-base text-ink"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Strain type, if it is a strain
        <select
          name="strainType"
          defaultValue=""
          className="rounded-control bg-surface-2 px-3 py-2 text-base text-ink"
        >
          <option value="">Not a strain</option>
          {STRAIN_TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2">
        <Button type="submit" name="kind" value="strain" disabled={pending}>
          Add a strain
        </Button>
        <Button type="submit" name="kind" value="item" variant="quiet" disabled={pending}>
          Add an item
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}

/** Its own form, with no field to fill in first. "Bringing none" is an
 *  answer, so giving it is one press — and the trigger clears whatever that
 *  member had listed. */
function NoneForm({ seshId }: { seshId: string }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    addContribution,
    null,
  );

  return (
    <form action={action} className={CARD}>
      <input type="hidden" name="seshId" value={seshId} readOnly />
      <input type="hidden" name="kind" value="none" readOnly />
      <Button type="submit" variant="quiet" disabled={pending}>
        {pending ? "Saying…" : BRINGING_NONE}
      </Button>
      <Result state={state} />
    </form>
  );
}

export function OnDeck({ seshId, rows }: Props) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg">On deck</h2>

      {rows.length === 0 ? (
        <p className="rounded-card bg-surface p-4 text-sm text-ink-muted">
          Nobody has said what they are bringing yet. The list opens for a guest once the host
          approves them.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <ContributionCard key={row.id} seshId={seshId} row={row} />
          ))}
        </ul>
      )}

      {/* Both forms are offered to everyone, and for the same reason the
          Remove button is: the panel does not know who is reading it. An
          empty list is a requester AND a sesh nobody has spoken on yet, so
          hiding the forms on empty would take the first word away from the
          first approved guest. The database refuses the writes it should,
          and the action turns that refusal into a sentence. */}
      <AddForm seshId={seshId} />
      <NoneForm seshId={seshId} />
    </section>
  );
}
