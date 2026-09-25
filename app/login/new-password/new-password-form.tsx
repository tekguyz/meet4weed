"use client";

import { useState, useTransition } from "react";
import { changePassword, setNewPassword } from "@/app/auth/actions/recovery";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { FAILURE_TEXT, PASSWORDS_DIFFER } from "../failure-text";

/** A signed-in member has no reset link to run out; their session did. */
const CHANGE_TEXT = { ...FAILURE_TEXT, no_session: "Your session has ended. Sign in again, then change it." };

type Props = {
  /** `reset` is step 3 of the three in app/auth/actions/recovery.ts and goes
   *  home when done. `change` is Settings → Password (issue #65): the member
   *  stays and the shared banner says it worked. */
  mode?: "reset" | "change";
};

export function NewPasswordForm({ mode = "reset" }: Props) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    if (password !== again) {
      setResult({ ok: false, text: PASSWORDS_DIFFER });
      return;
    }
    startTransition(async () => {
      if (mode === "reset") {
        // Resolves only on failure; success redirects.
        const outcome = await setNewPassword({ password });
        if (outcome && !outcome.ok) setResult({ ok: false, text: FAILURE_TEXT[outcome.failure] });
        return;
      }
      const outcome = await changePassword({ password });
      if (!outcome.ok) {
        setResult({ ok: false, text: CHANGE_TEXT[outcome.failure] });
        return;
      }
      setPassword("");
      setAgain("");
      setResult({ ok: true, text: "Password changed." });
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <PasswordInput label="New password" name="password" autoComplete="new-password" required
        value={password} onChange={(e) => setPassword(e.target.value)} />
      <PasswordInput label="Type the new password again" name="password-again" autoComplete="new-password" required
        value={again} onChange={(e) => setAgain(e.target.value)} />
      <p className="text-xs text-ink-muted">{FAILURE_TEXT.weak_password}</p>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save password"}</Button>
      {result && mode === "change" ? (
        <Banner tone={result.ok ? "success" : "danger"}>{result.text}</Banner>
      ) : result ? (
        <Banner tone="danger" urgent>{result.text}</Banner>
      ) : null}
    </form>
  );
}
