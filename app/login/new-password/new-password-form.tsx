"use client";

import { useState, useTransition } from "react";
import { setNewPassword } from "@/app/auth/actions/recovery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FAILURE_TEXT } from "../failure-text";

/** Step 3 of the three in app/auth/actions/recovery.ts. */
export function NewPasswordForm() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      // Resolves only on failure; success redirects.
      const result = await setNewPassword({ password });
      if (result && !result.ok) setMessage(FAILURE_TEXT[result.failure]);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Input label="New password" name="password" type="password" autoComplete="new-password" required
        value={password} onChange={(e) => setPassword(e.target.value)} />
      <p className="text-xs text-ink-muted">{FAILURE_TEXT.weak_password}</p>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save password"}</Button>
      {message ? <p role="alert" className="text-sm text-danger">{message}</p> : null}
    </form>
  );
}
