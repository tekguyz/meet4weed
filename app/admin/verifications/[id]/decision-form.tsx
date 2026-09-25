"use client";

import { useActionState, useState } from "react";
import { decideVerification, type DecideState } from "./actions";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DecisionForm({ id, typedExpiry }: { id: string; typedExpiry: string }) {
  const [state, action, pending] = useActionState<DecideState, FormData>(decideVerification, null);
  const [decision, setDecision] = useState<"approve" | "reject" | "retake">("approve");

  return (
    <form action={action} className="flex flex-col gap-4 rounded-card bg-surface p-4">
      <input type="hidden" name="id" value={id} />
      <fieldset className="flex gap-4 text-sm">
        {(["approve", "reject", "retake"] as const).map((d) => (
          <label key={d} className="flex items-center gap-2">
            <input type="radio" name="decision" value={d} checked={decision === d} onChange={() => setDecision(d)} />
            {d === "approve" ? "Approve" : d === "reject" ? "Reject" : "Ask for a retake"}
          </label>
        ))}
      </fieldset>
      {decision === "approve" ? (
        <Input label="Expiry date printed on the card" name="cardExpiresOn" type="date" defaultValue={typedExpiry} required />
      ) : null}
      <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
        {decision === "approve" ? "Note (optional)" : "Reason the member will read"}
        <textarea
          name="reason"
          maxLength={500}
          required={decision !== "approve"}
          className="rounded-control border border-rule bg-bg p-3 text-base text-ink"
        />
      </label>
      <p className="text-xs text-ink-muted">Any decision deletes both photos immediately.</p>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save decision"}</Button>
      {state ? <Banner tone="danger" urgent nested>{state.message}</Banner> : null}
    </form>
  );
}
