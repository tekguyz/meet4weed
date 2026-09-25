import { Banner } from "@/components/ui/banner";
import { safeNext } from "@/lib/auth/safe-next";
import { APP_NAME, APP_TAGLINE } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const { next, error, mode } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">{APP_NAME}</h1>
        {/* Issue #68: a stranger who opens a shared link lands here first. */}
        <p className="text-sm text-ink-muted">{APP_TAGLINE}</p>
      </header>

      {/* Set only by app/auth/actions/email-link.ts. */}
      {error === "link_invalid" ? (
        <Banner tone="danger" urgent>
          That link is wrong, used or expired. Ask for a new one.
        </Banner>
      ) : null}

      {/* Set by app/(frame)/seshes/invite-actions.ts when somebody with no account
          presses an invite button. It carries NO token — the token is in an
          httpOnly cookie, and a query string is exactly where it must not be. */}
      <LoginForm next={safeNext(next)} signUp={mode === "sign-up"} />

      <p className="text-xs text-ink-muted">
        Every member's card is checked by a person. {APP_NAME} is a place to meet, never a place to
        buy or sell.
      </p>
    </main>
  );
}
