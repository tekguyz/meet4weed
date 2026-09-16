import { safeNext } from "@/lib/auth/safe-next";
import { APP_NAME, APP_TAGLINE } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">{APP_NAME}</h1>
        <p className="text-sm text-ink-muted">{APP_TAGLINE}</p>
      </header>

      {/* Set only by app/auth/actions/email-link.ts. */}
      {error === "link_invalid" ? (
        <p role="alert" className="text-sm text-danger">
          That link is wrong, used or expired. Ask for a new one.
        </p>
      ) : null}

      <LoginForm next={safeNext(next)} />

      <p className="text-xs text-ink-muted">
        {APP_NAME} is for verified Florida medical cannabis patients aged 21 and over. It is a place
        to meet, never a place to buy or sell.
      </p>
    </main>
  );
}
