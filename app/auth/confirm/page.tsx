import { confirmEmailLink } from "@/app/auth/actions/email-link";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/env";

export const metadata = { title: "Continue" };

/** Landing page for an emailed link. Renders a button and verifies NOTHING —
 *  the reason is in app/auth/actions/email-link.ts. */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash = "", type = "" } = await searchParams;
  const recovery = type === "recovery";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">{APP_NAME}</h1>
        <p className="text-sm text-ink-muted">
          {recovery
            ? "Tap to continue. You will choose a new password next."
            : "Tap to confirm your email address and finish creating your account."}
        </p>
      </header>
      <form action={confirmEmailLink}>
        <input type="hidden" name="token_hash" value={token_hash} />
        <input type="hidden" name="type" value={type} />
        <Button type="submit">{recovery ? "Continue to reset your password" : "Confirm my email"}</Button>
      </form>
    </main>
  );
}
