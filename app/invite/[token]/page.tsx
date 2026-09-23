import { RedeemInvite } from "@/components/sesh/redeem-invite";
import { Banner } from "@/components/ui/banner";
import { APP_NAME } from "@/lib/env";
import { getInvitePreview } from "@/lib/sesh/invite-reads";
import { INVITE_FAILED } from "@/lib/sesh/invites";

/** `referrer: no-referrer` is not decoration. The token is a path segment, so
 *  every link and every form post from this page would otherwise hand it to
 *  whatever it went to in a Referer header. Nothing may carry a live token
 *  off this page. */
export const metadata = { title: "An invite", referrer: "no-referrer" as const };

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
 * would turn this page into a machine for finding live links. A token carried
 * back here by a tampered hold cookie lands in the same place, which is why
 * lib/sesh/held-invite.ts checks shape and never the tag.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token: segment } = await params;
  // A token is base64url plus a dot, so nothing in it ever needs escaping.
  // Decoded once, here, and used everywhere below — decoding twice would
  // quietly change a token that ever did contain a percent.
  const token = decodeURIComponent(segment);

  // NOBODY IS SENT ANYWHERE FROM HERE, signed in or signed out. `/invite` is
  // public in lib/supabase/session.ts, and a visitor with no account sees
  // EXACTLY this page: title, start time, button, nothing else. The page does
  // not know or care whether anyone is signed in, so there is no second
  // rendering to keep in step with this one.
  //
  // The split happens on the press, inside app/seshes/invite-actions.ts, and
  // nowhere else. A signed-out press spends nothing: the token goes into a
  // short-lived httpOnly cookie and the person is sent to sign up. They come
  // back here and press again, and that press spends the use.
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
        <Banner>{INVITE_FAILED}</Banner>
      )}
    </main>
  );
}
