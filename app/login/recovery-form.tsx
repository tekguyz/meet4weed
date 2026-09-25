"use client";

import { useState, useTransition } from "react";
import { requestPasswordReset } from "@/app/auth/actions/recovery";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMAIL_LINK_EXPIRY_MINUTES } from "@/lib/auth/email-link-policy";
import { FAILURE_TEXT, LINK } from "./failure-text";

/** Step 1 of the three in app/auth/actions/recovery.ts. */
export function RecoveryForm({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await requestPasswordReset({ email });
      if (result.ok) setSent(true);
      else setMessage(FAILURE_TEXT[result.failure]);
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <Banner tone="success">
          If {email} has an account, we sent it a reset link. It expires in{" "}
          {EMAIL_LINK_EXPIRY_MINUTES} minutes.
        </Banner>
        <button type="button" onClick={onBack} className={LINK}>Back to sign in</button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h2 className="text-xl">Reset your password</h2>
      <Input label="Email" name="email" type="email" autoComplete="email" required
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
      {message ? <Banner tone="danger" urgent>{message}</Banner> : null}
      <button type="button" onClick={onBack} className={LINK}>Back to sign in</button>
    </form>
  );
}
