"use client";

import { useActionState } from "react";
import { addContribution, removeContribution } from "@/app/seshes/on-deck-actions";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/forms/action-state";
import { CONTRIBUTION_LABEL_MAX, BRINGING_NONE } from "@/lib/sesh/on-deck";
import { STRAIN_TYPES } from "@/lib/profiles/schema";
import type { ContributionRow } from "@/lib/sesh/queries";

/**
 * The bare on-deck list — ticket #26.
 *
 * DELIBERATELY PLAIN. The real panel is #27: the three states, the "bringing
 * none" button and the locked card. This exists so the rules underneath it
 * have somewhere to be exercised from.
 *
 * It takes what to render and NO IDENTITY — no `isApproved`, no member id, no
 * status — exactly like AddressPanel. An empty list is the locked state,
 * because `contributions_select` returns no rows to anyone the host has not
 * approved. The day somebody adds `if (isApproved)` here, the rule has left
 * Postgres and moved into a screen.
 */
type Props = {
  seshId: string;
  rows: ContributionRow[];
};

function Result({ state }: { state: ActionState | null }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-ink-muted" : "text-danger"}`}>
      {state.message}
    </p>
  );
}

function ContributionCard({ seshId, row }: { seshId: string; row: ContributionRow }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    removeContribution,
    null,
  );

  return (
    <li className="flex flex-col gap-2 rounded-card bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        {/* Same size, same weight, whatever the answer is. No warning colour,
            no sorting to the bottom, and the word "nothing" never appears. */}
        <span className="text-sm text-ink">{row.kind === "none" ? BRINGING_NONE : row.label}</span>
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

function AddForm({ seshId }: { seshId: string }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    addContribution,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-2 rounded-card bg-surface p-4">
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

export function OnDeck({ seshId, rows }: Props) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg">On deck</h2>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">Nobody has said yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <ContributionCard key={row.id} seshId={seshId} row={row} />
          ))}
        </ul>
      )}

      <AddForm seshId={seshId} />
    </section>
  );
}
