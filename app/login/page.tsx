"use client";

import { useActionState } from "react";
import { requestMagicLink, type MagicLinkState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_NAME, APP_TAGLINE } from "@/lib/env";

export default function LoginPage() {
  const [state, action, pending] = useActionState<MagicLinkState | null, FormData>(
    requestMagicLink,
    null,
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">{APP_NAME}</h1>
        <p className="text-sm text-ink-muted">{APP_TAGLINE}</p>
      </header>

      <form action={action} className="flex flex-col gap-4">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Email me a link"}
        </Button>
      </form>

      {state ? (
        <p role="status" className={state.ok ? "text-sm text-ink-muted" : "text-sm text-danger"}>
          {state.message}
        </p>
      ) : null}

      <p className="text-xs text-ink-muted">
        {APP_NAME} is for verified Florida medical cannabis patients aged 21 and over. It is a place
        to meet, never a place to buy or sell.
      </p>
    </main>
  );
}
