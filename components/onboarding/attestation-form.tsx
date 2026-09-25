"use client";

import { useActionState } from "react";
import { recordAttestation } from "@/app/onboarding/actions";
import type { ActionState } from "@/lib/forms/action-state";
import { AgreementLinks } from "@/components/legal/legal-links";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";

const CLAIMS = [
  { name: "age", label: "I am 21 or older." },
  { name: "resident", label: "I live in Florida." },
  { name: "card", label: "I hold a valid, unexpired Florida OMMU patient card." },
  { name: "noSales", label: "I will never use this app to buy or sell cannabis." },
] as const;

export function AttestationForm() {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    recordAttestation,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">Membership claims</legend>
        {CLAIMS.map((claim) => (
          <label key={claim.name} className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name={claim.name}
              required
              className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
            />
            <span>{claim.label}</span>
          </label>
        ))}
      </fieldset>

      <AgreementLinks lead="Continuing means you agree to the" />

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </Button>

      {state && !state.ok ? (
        <Banner tone="danger" urgent>
          {state.message}
        </Banner>
      ) : null}
    </form>
  );
}
