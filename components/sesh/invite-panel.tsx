"use client";

import { useActionState, useState } from "react";
import { mintInvite, revokeInvite, type MintState } from "@/app/seshes/invite-actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ActionState } from "@/lib/forms/action-state";
import type { InviteRow } from "@/lib/sesh/invite-reads";
import {
  CLAIMED_NOT_YET,
  INVITE_DAY_OPTIONS,
  INVITE_DAYS_DEFAULT,
  INVITE_USES_DEFAULT,
  INVITE_USES_MAX,
  INVITES_PER_SESH,
} from "@/lib/sesh/invites";

/**
 * The host's invite panel.
 *
 * THE LINK IS SHOWN ONCE. It comes back in the reply to the mint and is never
 * fetched again, because it is nowhere to fetch from: the database holds only
 * sha256 of it, and `authenticated` holds no SELECT grant on that column
 * either. Every row below is a link the host can count and revoke and cannot
 * re-read. The copy button is not a convenience — it is the only chance.
 *
 * A CLAIM IS A SENTENCE, NEVER A STATUS. "claimed, not yet able to join" is
 * true whether the person has not verified, is waiting on card review, has an
 * expired card, or simply has not pressed "ask to come" yet. One derived
 * state, several causes, none of them disclosed — handing a host even the
 * first three would be handing over a piece of somebody's verification
 * record. Nothing in this component's props carries one, and nothing in
 * lib/sesh/invite-reads.ts fetches one. See the test beside this file.
 */

const USE_OPTIONS = Array.from({ length: INVITE_USES_MAX }, (_, i) => ({
  value: String(i + 1),
  label: i === 0 ? "1 person" : `${i + 1} people`,
}));

const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function Result({ state }: { state: ActionState | null }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-ink-muted" : "text-danger"}`}>
      {state.message}
    </p>
  );
}

function CopyBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface-2 p-3">
      {/* readOnly, not disabled: a host on a browser where the clipboard API
          is refused must still be able to select the text by hand. */}
      <input
        readOnly
        value={url}
        aria-label="Invite link"
        onFocus={(event) => event.currentTarget.select()}
        className="w-full rounded-control border border-rule bg-surface px-3 py-2 text-sm text-ink"
      />
      <Button
        type="button"
        variant="quiet"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            // Refused, or no clipboard at all. The box above is still there
            // to select by hand, so there is nothing to report.
          }
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}

function RevokeButton({ inviteId, seshId }: { inviteId: string; seshId: string }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(revokeInvite, null);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="inviteId" value={inviteId} readOnly />
      <input type="hidden" name="seshId" value={seshId} readOnly />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-control bg-surface-2 px-3 py-2 text-sm text-danger disabled:opacity-50"
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
      <Result state={state} />
    </form>
  );
}

function InviteCard({ invite, seshId }: { invite: InviteRow; seshId: string }) {
  return (
    <li className="flex flex-col gap-2 rounded-card bg-surface p-4">
      <p className="text-sm text-ink">
        {invite.useCount} of {invite.maxUses} used
      </p>
      <p className="text-sm text-ink-muted">
        {invite.revokedAt
          ? "Revoked. Everyone who already used it is still coming."
          : invite.live
            ? `Good until ${WHEN.format(new Date(invite.expiresAt))} ET`
            : "Finished."}
      </p>

      {/* One line per person the host has not met in the queue yet. The
          sentence is the whole payload — there is no name, no handle and no
          status behind it. */}
      {invite.waitingCount > 0 ? (
        <ul className="flex flex-col gap-1">
          {Array.from({ length: invite.waitingCount }, (_, i) => (
            <li key={i} className="text-sm text-ink-muted">
              {CLAIMED_NOT_YET}
            </li>
          ))}
        </ul>
      ) : null}

      {invite.revokedAt ? null : <RevokeButton inviteId={invite.id} seshId={seshId} />}
    </li>
  );
}

export function InvitePanel({ seshId, invites }: { seshId: string; invites: InviteRow[] }) {
  const [state, action, pending] = useActionState<MintState | null, FormData>(mintInvite, null);
  const live = invites.filter((invite) => invite.live).length;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg">Invite links</h2>
      <p className="text-sm text-ink-muted">
        A link lets somebody ask to come. You still decide, one by one, and the address only
        appears once you say yes.
      </p>

      <form action={action} className="flex flex-col gap-3 rounded-card bg-surface p-4">
        <input type="hidden" name="seshId" value={seshId} readOnly />
        <Select
          name="uses"
          label="Good for"
          options={USE_OPTIONS}
          defaultValue={String(INVITE_USES_DEFAULT)}
        />
        <Select
          name="days"
          label="Lasts"
          options={INVITE_DAY_OPTIONS}
          defaultValue={String(INVITE_DAYS_DEFAULT)}
        />
        <Button type="submit" disabled={pending || live >= INVITES_PER_SESH}>
          {pending ? "Making a link…" : "Make a link"}
        </Button>
        {live >= INVITES_PER_SESH ? (
          <p className="text-sm text-ink-muted">
            {INVITES_PER_SESH} live links is the most for one sesh. Revoke one to make another.
          </p>
        ) : null}
        <Result state={state} />
        {state?.ok && state.url ? <CopyBox url={state.url} /> : null}
      </form>

      {invites.length === 0 ? (
        <p className="text-sm text-ink-muted">You have not made any links for this one.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {invites.map((invite) => (
            <InviteCard key={invite.id} invite={invite} seshId={seshId} />
          ))}
        </ul>
      )}
    </section>
  );
}
