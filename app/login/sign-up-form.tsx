"use client";

import { useState, useTransition } from "react";
import { signUpWithPassword } from "@/app/auth/actions/sign-up";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMAIL_LINK_EXPIRY_MINUTES } from "@/lib/auth/email-link-policy";
import { FAILURE_TEXT, LINK } from "./failure-text";

export function SignUpForm({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await signUpWithPassword({ email, password });
      if (result.ok) setSent(true);
      else setMessage(FAILURE_TEXT[result.failure]);
    });
  }

  if (sent) {
    // Worded for both cases: an address that already has an account gets this
    // same screen and no email.
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-sm text-ink-muted">
          If {email} can be used, we sent it a confirmation link. It expires in{" "}
          {EMAIL_LINK_EXPIRY_MINUTES} minutes. Open it, then sign in with your password.
        </p>
        <button type="button" onClick={onBack} className={LINK}>Back to sign in</button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h2 className="text-xl">Create an account</h2>
      <Input label="Email" name="email" type="email" autoComplete="email" required
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input label="Password" name="password" type="password" autoComplete="new-password" required
        value={password} onChange={(e) => setPassword(e.target.value)} />
      <p className="text-xs text-ink-muted">{FAILURE_TEXT.weak_password}</p>
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create account"}</Button>
      {message ? <p role="alert" className="text-sm text-danger">{message}</p> : null}
      <button type="button" onClick={onBack} className={LINK}>Back to sign in</button>
    </form>
  );
}
