import { redirect } from "next/navigation";
import { RedeemInvite } from "@/components/sesh/redeem-invite";
import { APP_NAME } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getInvitePreview } from "@/lib/sesh/invite-reads";
import { INVITE_FAILED, invitePath } from "@/lib/sesh/invites";

export const metadata = { title: "An invite" };

const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "long",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * An invite link, opened.
 *
 * THIS PAGE SPENDS NOTHING. It renders a title, a start time and a button,
 * and that is the whole of it. Every modern chat app fetches a pasted link to
 * draw a preview card; one use is the default, so a link that spent itself on
 * that fetch would be dead before the recipient ever saw it. The use is spent
 * by the POST behind the button. app/auth/confirm/page.tsx already solves
 * exactly this for emailed auth links and carries the same note.
 *
 * IT SHOWS THE TITLE AND THE START TIME AND NOTHING ELSE. Not the area name,
 * not the fuzzy circle, not the host's handle, not even the sesh id — and it
 * cannot show them, because public.invite_preview() does not return them.
 * Enough for a human to know what they are being let into, and no more,
 * because a link travels further than the person it was sent to.
 *
 * Every failure — expired, used up, revoked, never existed, a flipped byte in
 * the signature — renders ONE identical sentence. Telling them apart is what
 * would turn this page into a machine for finding live links.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token: segment } = await params;
  // A token is base64url plus a dot, so nothing in it ever needs escaping.
  // Decoded once, here, and used everywhere below — decoding twice would
  // quietly change a token that ever did contain a percent.
  const token = decodeURIComponent(segment);

  // `/invite` is public in lib/supabase/session.ts, so a signed-out visitor
  // arrives here rather than at /login. Send them to sign in and bring them
  // straight back, because THIS ticket requires an authenticated caller and
  // a signed-out reader must not be told whether the link is any good.
  // Rendering INVITE_FAILED at them would be a lie about their link.
  //
  // #31 replaces this line with the cold path: the token goes into a signed,
  // httpOnly cookie, the person signs UP, and the second press spends the
  // use. The bounce stays one redirect either way — no automatic spend.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(invitePath(token))}`);

  const preview = await getInvitePreview(token);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">{APP_NAME}</h1>
        {preview ? (
          <p className="text-sm text-ink-muted">You have been sent a link to a sesh.</p>
        ) : null}
      </header>

      {preview ? (
        <>
          <section className="flex flex-col gap-2 rounded-card bg-surface p-4">
            <h2 className="text-xl text-ink">{preview.title}</h2>
            <p className="text-sm text-ink-muted">{WHEN.format(new Date(preview.startsAt))} ET</p>
          </section>
          <RedeemInvite token={token} />
          <p className="text-sm text-ink-muted">
            Using the link lets you ask to come. The host still decides.
          </p>
        </>
      ) : (
        <p role="status" className="rounded-card bg-surface p-4 text-sm text-ink">
          {INVITE_FAILED}
        </p>
      )}
    </main>
  );
}
