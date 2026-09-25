"use client";

import { useState, useTransition } from "react";
import { signInWithPassword } from "@/app/auth/actions/sign-in";
import { resendConfirmationLink } from "@/app/auth/actions/sign-up";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FAILURE_TEXT, LINK } from "./failure-text";
import { RecoveryForm } from "./recovery-form";
import { SignUpForm } from "./sign-up-form";

/** Sign in, with the ways out to sign-up and password reset. Copied in shape
 *  from tekguyz-squid-ink (c8ceb09), built on this app's own primitives. */
export function LoginForm({ next, signUp = false }: { next: string; signUp?: boolean }) {
  // `signUp` only picks which form opens first. Somebody sent here by an
  // invite has no account yet, so showing them the sign-in form and making
  // them find the link is a step for nothing. They can still press "Back".
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "recover">(signUp ? "sign-up" : "sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (mode === "sign-up") return <SignUpForm onBack={() => setMode("sign-in")} />;
  if (mode === "recover") return <RecoveryForm onBack={() => setMode("sign-in")} />;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      // Resolves only on failure; success redirects.
      const result = await signInWithPassword({ email, password, next });
      if (!result) return;
      setUnconfirmed(result.failure === "email_not_confirmed");
      setMessage(FAILURE_TEXT[result.failure]);
    });
  }

  function onResend() {
    startTransition(async () => {
      const result = await resendConfirmationLink({ email });
      setUnconfirmed(false);
      setMessage(result.ok ? `We sent a new confirmation link to ${email}.` : FAILURE_TEXT[result.failure]);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Input label="Email" name="email" type="email" autoComplete="email" required
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <PasswordInput label="Password" name="password" autoComplete="current-password" required
        value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      {message ? <Banner tone="danger" urgent>{message}</Banner> : null}
      {unconfirmed ? (
        <button type="button" onClick={onResend} disabled={pending} className={LINK}>
          Send a new confirmation link
        </button>
      ) : null}
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => setMode("recover")} className={LINK}>
          Forgot your password?
        </button>
        <button type="button" onClick={() => setMode("sign-up")} className={LINK}>
          Create an account
        </button>
      </div>
    </form>
  );
}
