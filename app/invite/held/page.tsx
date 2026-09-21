import Link from "next/link";
import { APP_NAME } from "@/lib/env";
import { INVITE_HELD_BODY, INVITE_HELD_TITLE } from "@/lib/sesh/invites";

export const metadata = { title: INVITE_HELD_TITLE };

/**
 * Where a claim goes when the claimant cannot read the sesh yet.
 *
 * They pressed the button, public.redeem_invite() wrote the claim row, and
 * private.can_browse() still refuses them the sesh because a person has not
 * approved their medical card. Sending them to /seshes/<id> would have shown
 * them a 404 for a sesh that is genuinely theirs.
 *
 * IT NAMES NO SESH. No title, no start time, no id — the claim is not a key,
 * and this screen must not become one. The only sesh detail they ever saw is
 * the one on the invite page, before they pressed.
 *
 * A static segment beats a dynamic one in Next.js, so this wins over
 * /invite/[token] — and no token can collide with it anyway, because every
 * token contains a dot.
 */
export default function HeldInvitePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">{APP_NAME}</h1>
      </header>

      <section role="status" className="flex flex-col gap-2 rounded-card bg-surface p-4">
        <h2 className="text-xl text-ink">{INVITE_HELD_TITLE}</h2>
        <p className="text-sm text-ink-muted">{INVITE_HELD_BODY}</p>
      </section>

      <Link href="/verify" className="text-sm font-semibold text-primary underline">
        Verify your card
      </Link>
    </main>
  );
}
